import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
import type { Question, Answer } from "../domain/types";
import type { Reply } from "../domain/reply";
import { ServiceError } from "../services/errors";
import { StarRating } from "../components/StarRating";
import { useAuth } from "../app/providers/AuthProvider";
import { useUserData } from "../app/providers/UserDataProvider";
import { useReports } from "../app/providers/ReportsProvider";
import { useReputation } from "../app/providers/ReputationProvider";
import { CATEGORIES, PREDEFINED_TAGS } from "../services/categories/categoriesData";
import { formatDateTime } from "../services/utils";

/**
 * Extrae el código de error de un error desconocido.
 * Detecta códigos de Firebase (permission-denied, unauthenticated, etc.)
 */
function getErrorCode(err: unknown): string {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err instanceof ServiceError) return err.code || err.message;

  const anyErr = err as any;
  if (anyErr?.code && typeof anyErr.code === "string") return anyErr.code;
  if (anyErr?.message && typeof anyErr.message === "string") {
    const msg = anyErr.message.toLowerCase();
    if (msg.includes("permission") || msg.includes("permission-denied")) return "permission-denied";
    if (msg.includes("unauthenticated") || msg.includes("auth")) return "unauthenticated";
    return anyErr.message;
  }

  return "unknown";
}

export function QuestionDetailPage() {
  const { id: rawId = "" } = useParams();
  const id = rawId || "";
  const navigate = useNavigate();

  const {
    getById,
    addAnswer,
    registerView,
    updateQuestion,
    updateAnswer,
    rateAnswer,
    rateQuestion,
    deleteQuestion,
    deleteAnswer,
    addReply,
    listReplies
  } = useQuestions();

  const { user, refreshUser } = useAuth();
  const {
    saveQuestion,
    unsaveQuestion,
    isQuestionSaved,
    followQuestion,
    unfollowQuestion,
    isQuestionFollowed
  } = useUserData();

  const { createReport } = useReports();
  const { refresh: refreshReputation } = useReputation();

  const [question, setQuestion] = useState<Question | null>(null);
  const [content, setContent] = useState("");
  const [answerAnonymous, setAnswerAnonymous] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [notFound, setNotFound] = useState(false); // ✅ TAREA A: Solo true si el doc NO existe (getDoc.exists() == false)
  const [authError, setAuthError] = useState<string | null>(null); // Errores de permisos/auth

  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAnonymous, setEditAnonymous] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerContent, setEditAnswerContent] = useState("");

  const [ratingByAnswerId, setRatingByAnswerId] = useState<Record<string, number>>({});
  const [questionRating, setQuestionRating] = useState<number>(5);

  const [isSaved, setIsSaved] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportingAnswerId, setReportingAnswerId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<
    "spam" | "inappropriate" | "offensive" | "duplicate" | "other"
  >("spam");
  const [reportDescription, setReportDescription] = useState("");

  // Estados para replies
  const [repliesByAnswerId, setRepliesByAnswerId] = useState<Record<string, Reply[]>>({});
  const [replyContentByAnswerId, setReplyContentByAnswerId] = useState<Record<string, string>>({});
  const [showReplyFormByAnswerId, setShowReplyFormByAnswerId] = useState<Record<string, boolean>>({});
  const [loadingRepliesByAnswerId, setLoadingRepliesByAnswerId] = useState<Record<string, boolean>>({});

  // Inicializa selects de rating por respuesta
  useEffect(() => {
    if (!question) return;
    setRatingByAnswerId((prev) => {
      const next = { ...prev };
      for (const a of question.answers) {
        if (next[a.id] == null) next[a.id] = 5;
      }
      return next;
    });
  }, [question]);

  // ✅ TAREA A: Cargar pregunta diferenciando doc inexistente vs error
  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoadingQuestion(false);
      return;
    }

    setLoadingQuestion(true);
    setNotFound(false);
    setAuthError(null);
    setError(null);
    setQuestion(null);

    (async () => {
      try {
        const q = await getById(id);

        // ✅ TAREA A: Si retorna null, el doc NO existe (getDoc.exists() == false)
        if (!q) {
          console.log("[QuestionDetailPage] getById retornó null - documento no encontrado");
          setNotFound(true);
          setLoadingQuestion(false);
          return;
        }

        setQuestion(q);
        setEditTitle(q.title);
        setEditDescription(q.description);
        setEditAnonymous(q.isAnonymous);
        setEditCategory(q.category);
        setEditTags([...q.tags]);

        // Solo si hay usuario, consultamos cosas del perfil
        if (user) {
          try {
            setIsSaved(await isQuestionSaved(q.id));
            setIsFollowed(await isQuestionFollowed(q.id));
          } catch (err: any) {
            const errorMsg = `[QuestionDetailPage] ⚠️ WARNING: Error verificando isSaved/isFollowed: ${err?.message || err?.code || err || "Error desconocido"}`;
            console.warn(errorMsg, err);
          }
        }

        // Registrar vista (no debe romper el render si falla)
        if (user) {
          try {
            await registerView(q.id);
            // ✅ TAREA A: Después de registerView, recargar pregunta desde Firestore
            const updatedQ = await getById(q.id);
            if (updatedQ) setQuestion(updatedQ);
          } catch (err: any) {
            const errorMsg = `[QuestionDetailPage] ⚠️ WARNING: Error registrando vista (no bloquea): ${err?.message || err?.code || err || "Error desconocido"}`;
            console.warn(errorMsg, err);
          }
        }
      } catch (err) {
        const code = getErrorCode(err);
        console.error("[QuestionDetailPage] getById error:", err, "code:", code);

        // ✅ TAREA A: NO marcar notFound=true en cualquier error catch
        // Diferenciar: doc inexistente vs error (PERMISSION_DENIED, network)
        if (code === "permission-denied" || code.includes("permission")) {
          setAuthError("permission-denied");
          setNotFound(false); // NO es "no encontrada", es error de permisos
        } else if (code === "unauthenticated" || code.includes("auth")) {
          setAuthError("unauthenticated");
          setNotFound(false);
        } else {
          // Error genérico (network, etc.) - NO asumir notFound
          setError(code === "unknown" ? "Error cargando la pregunta" : String(code));
          setNotFound(false);
        }
      } finally {
        setLoadingQuestion(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // No depender de user?.id para cargar la pregunta (lectura pública)

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }
    if (!question) {
      setError("No se encontró la pregunta para responder");
      return;
    }

    setLoading(true);
    try {
      await addAnswer({
        questionId: question.id,
        content,
        isAnonymous: answerAnonymous
      });

      setContent("");
      setAnswerAnonymous(false);

      // ✅ TAREA A: Después de addAnswer, recargar pregunta y answers desde Firestore
      const q = await getById(question.id);
      if (q) setQuestion(q);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo agregar la respuesta");
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ TAREA A: CORREGIDO - el autor de la pregunta es question.authorId, NO question.id
  const canEditQuestion = useMemo(() => {
    return Boolean(user && question && user.id === question.authorId);
  }, [user, question]);

  async function onSaveQuestionEdit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }
    if (!question) {
      setError("No se encontró la pregunta");
      return;
    }

    setLoading(true);
    try {
      await updateQuestion({
        id: question.id,
        title: editTitle,
        description: editDescription,
        isAnonymous: editAnonymous,
        category: editCategory,
        tags: editTags
      });

      const q = await getById(question.id);
      if (q) {
        setQuestion(q);
        setIsEditingQuestion(false);
      }
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo editar la pregunta");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSaveAnswerEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingAnswerId) return;

    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }
    if (!question) {
      setError("No se encontró la pregunta");
      return;
    }

    setLoading(true);
    try {
      await updateAnswer({
        questionId: question.id,
        answerId: editingAnswerId,
        content: editAnswerContent
      });

      const q = await getById(question.id);
      if (q) {
        setQuestion(q);
        setEditingAnswerId(null);
        setEditAnswerContent("");
      }
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo editar la respuesta");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onRateAnswer(a: Answer) {
    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }
    if (!question) {
      setError("No se encontró la pregunta");
      return;
    }

    const val = ratingByAnswerId[a.id] ?? 5;

    setLoading(true);
    setError(null);
    setAuthError(null);
    
    try {
      // ✅ Guardar rating (esto ya actualiza el estado en QuestionsProvider)
      await rateAnswer({ questionId: question.id, answerId: a.id, value: val });
      
      // ✅ Refrescar pregunta desde Firestore para obtener ratingAvg/ratingCount actualizados
      const q = await getById(question.id);
      if (q) {
        setQuestion(q);
        // ✅ Actualizar estado local para reflejar el cambio inmediatamente
        
        // Recargar replies para esta respuesta (best-effort)
        try {
          await loadRepliesForAnswer(a.id);
        } catch (repliesErr: any) {
          console.warn(`[onRateAnswer] ⚠️ Error cargando replies (no bloquea): ${repliesErr?.message || repliesErr}`);
        }
      } else {
        // ✅ Si no se pudo recargar, actualizar estado local optimísticamente
        setQuestion((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            answers: prev.answers.map((ans) => {
              if (ans.id === a.id) {
                const newCount = ans.ratingCount + 1;
                const newAvg = ans.ratingCount > 0
                  ? Math.round(((ans.ratingAvg * ans.ratingCount + val) / newCount) * 10) / 10
                  : val;
                return {
                  ...ans,
                  ratingAvg: newAvg,
                  ratingCount: newCount,
                };
              }
              return ans;
            }),
          };
        });
      }
      
      // ✅ Refrescar usuario y reputación para actualizar XP en tiempo real (best-effort)
      try {
        await refreshUser();
        await refreshReputation();
      } catch (refreshError: any) {
        const errorMsg = `[onRateAnswer] ⚠️ WARNING: No se pudo refrescar usuario/reputación (no bloquea): ${refreshError?.message || refreshError?.code || refreshError || "Error desconocido"}`;
        console.warn(errorMsg, refreshError);
      }
    } catch (err) {
      const code = getErrorCode(err);
      let errorMessage = "No se pudo calificar la respuesta. Por favor, intenta de nuevo.";
      
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
        errorMessage = "No tienes permisos para calificar esta respuesta";
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
        errorMessage = "Debes iniciar sesión para calificar";
      } else if (err instanceof ServiceError) {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
      // ✅ Mostrar mensaje visible al usuario (ya está en setError, se muestra en UI)
      console.error(`[onRateAnswer] ❌ Error calificando respuesta: ${code} - ${errorMessage}`);
    } finally {
      // ✅ Siempre resetear loading, incluso si hay error
      setLoading(false);
    }
  }

  async function onRateQuestion() {
    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }
    if (!question) {
      setError("No se encontró la pregunta");
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(null);
    
    try {
      // ✅ a) Guardar rating (esto ya actualiza el estado en QuestionsProvider)
      await rateQuestion({ questionId: question.id, value: questionRating });
      
      // ✅ b) Actualizar estado local inmediatamente (refetch getQuestionById)
      const q = await getById(question.id);
      if (q) {
        setQuestion(q); // ✅ UI se actualiza inmediatamente aquí
      } else {
        // ✅ Fallback: actualizar estado local optimísticamente
        setQuestion((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ratingAvg: prev.ratingCount > 0 
              ? Math.round(((prev.ratingAvg * prev.ratingCount + questionRating) / (prev.ratingCount + 1)) * 10) / 10
              : questionRating,
            ratingCount: prev.ratingCount + 1,
          };
        });
      }
      
      // ✅ Refrescar usuario y reputación para actualizar XP en tiempo real (best-effort)
      try {
        await refreshUser();
        await refreshReputation();
      } catch (refreshError: any) {
        const errorMsg = `[onRateQuestion] ⚠️ WARNING: No se pudo refrescar usuario/reputación (no bloquea): ${refreshError?.message || refreshError?.code || refreshError || "Error desconocido"}`;
        console.warn(errorMsg, refreshError);
      }
    } catch (err) {
      const code = getErrorCode(err);
      let errorMessage = "No se pudo calificar la pregunta. Por favor, intenta de nuevo.";
      
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
        errorMessage = "No tienes permisos para calificar esta pregunta";
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
        errorMessage = "Debes iniciar sesión para calificar";
      } else if (err instanceof ServiceError) {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
      // ✅ Mostrar mensaje visible al usuario (ya está en setError, se muestra en UI)
      console.error(`[onRateQuestion] ❌ Error calificando pregunta: ${code} - ${errorMessage}`);
    } finally {
      // ✅ Siempre resetear loading, incluso si hay error
      setLoading(false);
    }
    
    // ✅ c) loadRepliesForAnswer en try/catch separado (NO bloquea la actualización de UI)
    if (question) {
      try {
        const currentQuestion = await getById(question.id);
        if (currentQuestion) {
          for (const answer of currentQuestion.answers) {
            await loadRepliesForAnswer(answer.id);
          }
        }
      } catch (repliesErr: any) {
        // ✅ Solo warning, no bloquea UI
        console.warn(`[onRateQuestion] ⚠️ Error cargando replies (no bloquea UI): ${repliesErr?.message || repliesErr?.code || repliesErr || "Error desconocido"}`);
      }
    }
  }

  // ✅ Delete Question function - calls domain-level delete function
  async function onDeleteQuestion() {
    if (!user || !question) {
      console.warn("[onDeleteQuestion] Missing user or question");
      return;
    }
    
    // ✅ Confirmation dialog before deletion
    if (!confirm("¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.")) {
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(null);

    try {
      console.log(`[onDeleteQuestion] Deleting question ${question.id}`);
      // ✅ Call domain-level delete function (not deleteDoc directly)
      await deleteQuestion(question.id);
      console.log(`[onDeleteQuestion] Question ${question.id} deleted successfully`);
      
      // ✅ Navigate back to home after successful deletion
      navigate("/home", { replace: true });
    } catch (err) {
      console.error(`[onDeleteQuestion] Error deleting question:`, err);
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
        setError("No tienes permisos para eliminar esta pregunta");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
        setError("Debes iniciar sesión para eliminar preguntas");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo eliminar la pregunta. Por favor, intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ TAREA F: Función para eliminar respuesta
  async function onDeleteAnswer(answerId: string) {
    if (!user || !question) return;
    
    if (!confirm("¿Estás seguro de que quieres eliminar esta respuesta? Esta acción no se puede deshacer.")) {
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(null);

    try {
      await deleteAnswer(question.id, answerId);
      // Recargar pregunta para reflejar cambios
      const q = await getById(question.id);
      if (q) setQuestion(q);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo eliminar la respuesta");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitReport(e: FormEvent) {
    e.preventDefault();
    if (!question) return;

    setError(null);
    setAuthError(null);

    if (!user) {
      setAuthError("unauthenticated");
      return;
    }

    setLoading(true);
    try {
      const targetType = reportingAnswerId ? "answer" : "question";
      const targetId = reportingAnswerId || question.id;

      await createReport({
        targetType,
        targetId,
        questionId: targetType === "answer" ? question.id : undefined,
        reason: reportReason,
        description: reportDescription
      });

      setShowReportForm(false);
      setReportingAnswerId(null);
      setReportDescription("");
      alert("Reporte enviado. Gracias por tu colaboración.");
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo enviar el reporte");
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ Funciones para replies
  async function loadRepliesForAnswer(answerId: string) {
    if (!question) return;
    
    setLoadingRepliesByAnswerId((prev) => ({ ...prev, [answerId]: true }));
    try {
      const replies = await listReplies(question.id, answerId);
      setRepliesByAnswerId((prev) => ({ ...prev, [answerId]: replies }));
    } catch (err: any) {
      const errorMsg = `[QuestionDetailPage] ⚠️ WARNING: Error cargando replies para respuesta ${answerId}: ${err?.message || err?.code || err || "Error desconocido"}`;
      console.warn(errorMsg, err);
    } finally {
      setLoadingRepliesByAnswerId((prev) => ({ ...prev, [answerId]: false }));
    }
  }

  async function onSubmitReply(answerId: string, e: FormEvent) {
    e.preventDefault();
    if (!user || !question) return;

    const replyContent = replyContentByAnswerId[answerId]?.trim() || "";
    if (replyContent.length < 2) {
      setError("La respuesta es muy corta");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await addReply({
        questionId: question.id,
        answerId: answerId,
        content: replyContent
      });

      // Limpiar formulario y recargar replies
      setReplyContentByAnswerId((prev) => ({ ...prev, [answerId]: "" }));
      setShowReplyFormByAnswerId((prev) => ({ ...prev, [answerId]: false }));
      await loadRepliesForAnswer(answerId);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "permission-denied" || code.includes("permission")) {
        setAuthError("permission-denied");
      } else if (code === "unauthenticated" || code.includes("auth")) {
        setAuthError("unauthenticated");
      } else if (err instanceof ServiceError) {
        setError(err.message);
      } else {
        setError("No se pudo agregar la respuesta");
      }
    } finally {
      setLoading(false);
    }
  }

  // Cargar replies cuando se carga la pregunta
  useEffect(() => {
    if (question) {
      for (const answer of question.answers) {
        loadRepliesForAnswer(answer.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  // UI: Loading
  if (loadingQuestion) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  // ✅ TAREA A: UI: Permisos / No auth (NO es "not found")
  if (authError) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "20px", background: "#fff3cd", borderRadius: "8px", textAlign: "center", border: "1px solid #ffeeba" }}>
          <p style={{ fontSize: "18px", marginBottom: "10px" }}>
            {authError === "permission-denied"
              ? "🚫 No tienes permisos para ver o interactuar con esta pregunta."
              : "🔒 Debes iniciar sesión para continuar."}
          </p>
          <Link
            to="/login"
            style={{
              padding: "10px 20px",
              background: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              display: "inline-block"
            }}
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  // ✅ TAREA A: UI: Not Found real (solo cuando el doc NO existe)
  if (notFound && !loadingQuestion) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", marginBottom: "20px" }}>Pregunta no encontrada.</p>
          <Link
            to="/home"
            style={{
              padding: "10px 20px",
              background: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold"
            }}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // UI: error general (no es notFound ni authError)
  if (!question && error) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "20px", background: "#f8d7da", borderRadius: "8px", textAlign: "center", border: "1px solid #f5c6cb" }}>
          <p style={{ fontSize: "18px", marginBottom: "10px" }}>⚠️ No se pudo cargar la pregunta.</p>
          <p style={{ margin: 0, color: "#721c24" }}>{String(error)}</p>
          <div style={{ marginTop: "14px" }}>
            <Link
              to="/home"
              style={{
                padding: "10px 20px",
                background: "#007bff",
                color: "white",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: "bold"
              }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay pregunta pero tampoco hay error claro, seguir mostrando loading
  if (!question) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  // Guard explícito para TypeScript: después de este punto, question es no-null
  if (!question) {
    return null;
  }

  // ✅ TAREA A: CORREGIDO - botones que dependían de user.id !== question.id
  const canReportQuestion = Boolean(user && user.id !== question.authorId);
  const canRateQuestion = Boolean(user && user.id !== question.authorId && question.ratingsByUserId[user.id] == null);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <Link
        to="/home"
        style={{
          display: "inline-block",
          marginBottom: "20px",
          color: "#007bff",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: "500"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        ← Volver
      </Link>

      <div style={{ padding: "24px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <h1 style={{ marginTop: 0, marginBottom: "16px", fontSize: "28px", fontWeight: "bold" }}>{question.title}</h1>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px", fontSize: "14px", color: "#666" }}>
          <span>
            Autor:{" "}
            {question.isAnonymous ? (
              <strong>Anónimo</strong>
            ) : (
              <Link
                to={`/profile/${question.authorId}`}
                state={{ fromQuestionId: question.id }}
                style={{
                  color: "#007bff",
                  textDecoration: "none",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {question.authorName}
              </Link>
            )}
          </span>
          <span>·</span>
          <span>{formatDateTime(question.createdAt)}</span>
          <span>·</span>
          <span>{question.answers.length} {question.answers.length === 1 ? "respuesta" : "respuestas"}</span>
          <span>·</span>
          <span>{question.viewsCount} vistas</span>
          {question.ratingAvg > 0 && (
            <>
              <span>·</span>
              <span>⭐ {question.ratingAvg.toFixed(1)} ({question.ratingCount} votos)</span>
            </>
          )}
        </div>

        <div style={{ marginBottom: "16px", padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
          <p style={{ margin: 0, fontSize: "16px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{question.description}</p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          {question.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "4px 12px",
                background: "#e7f3ff",
                color: "#007bff",
                borderRadius: "16px",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {user && (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (isSaved) {
                    await unsaveQuestion(question.id);
                    setIsSaved(false);
                  } else {
                    await saveQuestion(question.id);
                    setIsSaved(true);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  background: isSaved ? "#28a745" : "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background 0.2s"
                }}
              >
                {isSaved ? "💾 Guardada" : "💾 Guardar pregunta"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (isFollowed) {
                    await unfollowQuestion(question.id);
                    setIsFollowed(false);
                  } else {
                    await followQuestion(question.id);
                    setIsFollowed(true);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  background: isFollowed ? "#007bff" : "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background 0.2s"
                }}
              >
                {isFollowed ? "🔔 Siguiendo" : "🔔 Seguir pregunta"}
              </button>
            </>
          )}

          {canReportQuestion && (
            <button
              type="button"
              onClick={() => {
                setShowReportForm(true);
                setReportingAnswerId(null);
                setReportReason("spam");
                setReportDescription("");
              }}
              style={{
                padding: "8px 16px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              ⚠️ Reportar pregunta
            </button>
          )}
        </div>
      </div>

      {showReportForm && (
        <div style={{ padding: "20px", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Reportar {reportingAnswerId ? "respuesta" : "pregunta"}</h3>
          <form onSubmit={onSubmitReport}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Motivo</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as any)}
                style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
              >
                <option value="spam">Spam</option>
                <option value="inappropriate">Contenido inapropiado</option>
                <option value="offensive">Ofensivo</option>
                <option value="duplicate">Duplicado</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Descripción</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                placeholder="Describe el problema..."
                style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                disabled={loading || !reportDescription.trim()}
                style={{
                  padding: "10px 20px",
                  background: loading || !reportDescription.trim() ? "#ccc" : "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading || !reportDescription.trim() ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                Enviar reporte
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReportForm(false);
                  setReportingAnswerId(null);
                  setReportDescription("");
                }}
                style={{
                  padding: "10px 20px",
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ✅ Rating de pregunta: mostrar promedio y tu calificación separados */}
      {question && (
        <div style={{ padding: "16px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
          {user ? (
            <StarRating
              value={canRateQuestion ? questionRating : (question.ratingsByUserId[user.id] || 0)}
              onChange={canRateQuestion ? (value) => setQuestionRating(value) : undefined}
              readOnly={!canRateQuestion}
              size="medium"
              showAverage={true}
              average={question.ratingAvg}
              count={question.ratingCount}
              showUserRating={true}
              onSave={() => {
                // Mostrar confirmación después de guardar
                setTimeout(() => {
                  // El estado se actualizará cuando se recargue la pregunta
                }, 100);
              }}
            />
          ) : (
            <div>
              <StarRating
                value={0}
                readOnly={true}
                size="medium"
                showAverage={true}
                average={question.ratingAvg}
                count={question.ratingCount}
              />
              <p style={{ marginTop: "12px", fontSize: "14px", color: "#666" }}>
                <Link to="/login" style={{ color: "#007bff", textDecoration: "underline" }}>
                  Inicia sesión para calificar
                </Link>
              </p>
            </div>
          )}
          {canRateQuestion && user && (
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={onRateQuestion}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  background: loading ? "#ccc" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                {loading ? "Calificando..." : "Guardar calificación"}
              </button>
            </div>
          )}
        </div>
      )}

      {canEditQuestion && (
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
          {/* ✅ Display errors related to delete operation */}
          {(error || authError) && (
            <div 
              role="alert" 
              style={{ 
                padding: "12px", 
                marginBottom: "15px", 
                background: authError ? "#f8d7da" : "#f8d7da", 
                color: "#721c24", 
                border: "1px solid #f5c6cb", 
                borderRadius: "4px",
                fontSize: "14px"
              }}
            >
              {error || (authError === "permission-denied" ? "No tienes permisos para realizar esta acción." : authError === "unauthenticated" ? "Debes iniciar sesión para realizar esta acción." : "Ha ocurrido un error.")}
            </div>
          )}
          
          {!isEditingQuestion ? (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setIsEditingQuestion(true)}
                style={{
                  padding: "10px 20px",
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                ✏️ Editar pregunta
              </button>
              {/* ✅ Delete Question button - calls domain-level delete function */}
              <button
                type="button"
                onClick={onDeleteQuestion}
                disabled={loading || !user || !question}
                style={{
                  padding: "10px 20px",
                  background: loading || !user || !question ? "#ccc" : "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading || !user || !question ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  transition: "background-color 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!loading && user && question) {
                    e.currentTarget.style.background = "#c82333";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && user && question) {
                    e.currentTarget.style.background = "#dc3545";
                  }
                }}
              >
                {loading ? "⏳ Eliminando..." : "🗑️ Eliminar pregunta"}
              </button>
            </div>
          ) : (
            <form onSubmit={onSaveQuestionEdit}>
              <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Editar pregunta</h2>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Título</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Descripción</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px", fontFamily: "inherit" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editAnonymous}
                    onChange={(e) => setEditAnonymous(e.target.checked)}
                    style={{ width: "18px", height: "18px" }}
                  />
                  Publicar como anónimo
                </label>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Categoría</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                  Etiquetas (selecciona entre 1 y 5)
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: "10px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    padding: "10px",
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "4px"
                  }}
                >
                  {PREDEFINED_TAGS.map((tag) => (
                    <label key={tag} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={editTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (editTags.length < 5) setEditTags([...editTags, tag]);
                          } else {
                            setEditTags(editTags.filter((t) => t !== tag));
                          }
                        }}
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>

                <p style={{ marginTop: "10px", color: editTags.length >= 1 && editTags.length <= 5 ? "#28a745" : "#dc3545", fontWeight: "bold" }}>
                  Seleccionadas: {editTags.length} / 5
                </p>
              </div>

              {error && (
                <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "12px 24px",
                    background: loading ? "#ccc" : "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "16px",
                    fontWeight: "bold"
                  }}
                >
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditingQuestion(false);
                    setEditTitle(question.title);
                    setEditDescription(question.description);
                    setEditAnonymous(question.isAnonymous);
                    setEditCategory(question.category);
                    setEditTags([...question.tags]);
                  }}
                  style={{
                    padding: "12px 24px",
                    background: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold"
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>
          Respuestas ({question.answers.length})
        </h2>

        {question.answers.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>
            Aún no hay respuestas. ¡Sé el primero en responder!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {question.answers.map((a) => (
              <div
                key={a.id}
                id={`answer-${a.id}`}
                style={{
                  padding: "20px",
                  background: "#fff",
                  borderRadius: "8px",
                  border: question.trophyAnswerId === a.id ? "2px solid #ffc107" : "1px solid #ddd"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      {a.isAnonymous ? (
                        <strong style={{ fontSize: "16px" }}>Anónimo</strong>
                      ) : (
                        <Link
                          to={`/profile/${a.authorId}`}
                          state={{ fromQuestionId: question.id }}
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#007bff",
                            textDecoration: "none",
                            cursor: "pointer"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {a.authorName}
                        </Link>
                      )}
                      <span style={{ fontSize: "12px", color: "#999" }}>
                        {formatDateTime(a.createdAt)}
                      </span>
                    </div>

                    {question.trophyAnswerId === a.id && (
                      <span style={{ padding: "4px 8px", background: "#ffc107", color: "#000", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                        🏆 Mejor aporte
                      </span>
                    )}

                    <StarRating
                      value={0}
                      readOnly={true}
                      size="small"
                      showAverage={true}
                      average={a.ratingAvg}
                      count={a.ratingCount}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {user?.id === a.authorId && editingAnswerId !== a.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAnswerId(a.id);
                            setEditAnswerContent(a.content);
                          }}
                          style={{ padding: "6px 12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                        >
                          ✏️ Editar
                        </button>
                        {/* ✅ TAREA F: Botón para eliminar respuesta */}
                        <button
                          type="button"
                          onClick={() => onDeleteAnswer(a.id)}
                          disabled={loading}
                          style={{ padding: "6px 12px", background: loading ? "#ccc" : "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontSize: "12px" }}
                        >
                          🗑️ Eliminar
                        </button>
                      </>
                    )}

                    {user && user.id !== a.authorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReportForm(true);
                          setReportingAnswerId(a.id);
                          setReportReason("spam");
                          setReportDescription("");
                        }}
                        style={{ padding: "6px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                      >
                        ⚠️ Reportar
                      </button>
                    )}
                  </div>
                </div>

                {editingAnswerId === a.id ? (
                  <form onSubmit={onSaveAnswerEdit}>
                    <textarea
                      value={editAnswerContent}
                      onChange={(e) => setEditAnswerContent(e.target.value)}
                      rows={4}
                      style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px", fontFamily: "inherit", marginBottom: "10px" }}
                      required
                    />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: "8px 16px", background: loading ? "#ccc" : "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "bold" }}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnswerId(null);
                          setEditAnswerContent("");
                        }}
                        style={{ padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <p style={{ margin: 0, fontSize: "16px", lineHeight: "1.6", whiteSpace: "pre-wrap", marginBottom: "12px" }}>{a.content}</p>
                )}

                {user && a.ratingsByUserId[user.id] == null && user.id !== a.authorId && (
                  <div style={{ paddingTop: "12px", borderTop: "1px solid #eee" }}>
                    <StarRating
                      value={ratingByAnswerId[a.id] ?? 5}
                      onChange={(value) => setRatingByAnswerId((prev) => ({ ...prev, [a.id]: value }))}
                      size="medium"
                      showAverage={true}
                      average={a.ratingAvg}
                      count={a.ratingCount}
                      showUserRating={true}
                    />
                    <div style={{ marginTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => onRateAnswer(a)}
                        disabled={loading}
                        style={{
                          padding: "6px 12px",
                          background: loading ? "#ccc" : "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontSize: "14px",
                          fontWeight: "bold"
                        }}
                      >
                        {loading ? "Calificando..." : "Guardar calificación"}
                      </button>
                    </div>
                  </div>
                )}

                {user && a.ratingsByUserId[user.id] != null && (
                  <div style={{ paddingTop: "12px", borderTop: "1px solid #eee" }}>
                    <StarRating
                      value={a.ratingsByUserId[user.id]}
                      readOnly={true}
                      size="medium"
                      showAverage={true}
                      average={a.ratingAvg}
                      count={a.ratingCount}
                      showUserRating={true}
                    />
                  </div>
                )}

                {/* ✅ Replies: Mostrar replies y formulario */}
                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "2px solid #eee" }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
                    Respuestas ({repliesByAnswerId[a.id]?.length || 0})
                  </h4>
                  
                  {/* Lista de replies */}
                  {loadingRepliesByAnswerId[a.id] ? (
                    <p style={{ fontSize: "14px", color: "#666" }}>Cargando respuestas...</p>
                  ) : repliesByAnswerId[a.id] && repliesByAnswerId[a.id].length > 0 ? (
                    <div style={{ marginBottom: "16px" }}>
                      {repliesByAnswerId[a.id].map((reply) => (
                        <div
                          key={reply.id}
                          style={{
                            padding: "12px",
                            marginBottom: "8px",
                            background: "#f9f9f9",
                            borderRadius: "6px",
                            borderLeft: "3px solid #007bff"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#007bff" }}>
                              {reply.authorName}
                            </span>
                            <span style={{ fontSize: "12px", color: "#999" }}>
                              {formatDateTime(reply.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                            {reply.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>No hay respuestas aún.</p>
                  )}

                  {/* Formulario para agregar reply */}
                  {user && (
                    <div>
                      {!showReplyFormByAnswerId[a.id] ? (
                        <button
                          type="button"
                          onClick={() => setShowReplyFormByAnswerId((prev) => ({ ...prev, [a.id]: true }))}
                          style={{
                            padding: "8px 16px",
                            background: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "500"
                          }}
                        >
                          💬 Responder
                        </button>
                      ) : (
                        <form onSubmit={(e) => onSubmitReply(a.id, e)}>
                          <textarea
                            value={replyContentByAnswerId[a.id] || ""}
                            onChange={(e) => setReplyContentByAnswerId((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            rows={3}
                            placeholder="Escribe tu respuesta aquí..."
                            style={{
                              width: "100%",
                              padding: "10px",
                              fontSize: "14px",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontFamily: "inherit",
                              marginBottom: "8px"
                            }}
                            required
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="submit"
                              disabled={loading}
                              style={{
                                padding: "6px 12px",
                                background: loading ? "#ccc" : "#28a745",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer",
                                fontSize: "14px",
                                fontWeight: "500"
                              }}
                            >
                              {loading ? "Enviando..." : "Enviar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowReplyFormByAnswerId((prev) => ({ ...prev, [a.id]: false }));
                                setReplyContentByAnswerId((prev) => ({ ...prev, [a.id]: "" }));
                              }}
                              style={{
                                padding: "6px 12px",
                                background: "#6c757d",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "500"
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>Agregar respuesta</h2>

        {!user ? (
          <div style={{ padding: "12px", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffeeba" }}>
            <p style={{ margin: 0 }}>
              🔒 Para responder, debes <Link to="/login">iniciar sesión</Link>.
            </p>
          </div>
        ) : user && question && user.id === question.authorId ? (
          <div style={{ padding: "12px", background: "#f8d7da", borderRadius: "8px", border: "1px solid #f5c6cb" }}>
            <p style={{ margin: 0, color: "#721c24", fontWeight: "bold" }}>
              🚫 No puedes responder tu propia pregunta. Sin embargo, puedes responder a las respuestas de otros usuarios usando "Responder" debajo de cada respuesta.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Tu respuesta</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Escribe tu respuesta aquí..."
                style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px", fontFamily: "inherit" }}
                required
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={answerAnonymous}
                  onChange={(e) => setAnswerAnonymous(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
                Publicar respuesta como anónimo
              </label>
            </div>

            {error && (
              <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 24px",
                background: loading ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "bold"
              }}
            >
              {loading ? "Publicando..." : "Publicar respuesta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
