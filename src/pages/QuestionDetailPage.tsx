import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
import type { Question } from "../domain/types";
import type { Answer } from "../domain/types";
import { ServiceError } from "../services/errors";
import { formatStars, ratingOptions } from "../ui/stars";
import { useAuth } from "../app/providers/AuthProvider";
import { useUserData } from "../app/providers/UserDataProvider";
import { useReports } from "../app/providers/ReportsProvider";
import { CATEGORIES, PREDEFINED_TAGS } from "../services/categories/categoriesData";

export function QuestionDetailPage() {
  const { id: rawId = "" } = useParams();
  // Normalizar el id: eliminar espacios y asegurar que sea string
  const id = rawId ? String(rawId).trim() : "";
  const { getById, addAnswer, registerView, updateQuestion, updateAnswer, rateAnswer, rateQuestion } = useQuestions();
  const { user } = useAuth();
  const { saveQuestion, unsaveQuestion, isQuestionSaved, followQuestion, unfollowQuestion, isQuestionFollowed } = useUserData();

  const [question, setQuestion] = useState<Question | null>(null);
  const [content, setContent] = useState("");
  const [answerAnonymous, setAnswerAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
  const [reportReason, setReportReason] = useState<"spam" | "inappropriate" | "offensive" | "duplicate" | "other">("spam");
  const [reportDescription, setReportDescription] = useState("");
  const { createReport } = useReports();

  useEffect(() => {
    if (!question) return;
    // inicializar select con 5 por defecto si no existe
    setRatingByAnswerId((prev) => {
      const next = { ...prev };
      for (const a of question.answers) {
        if (next[a.id] == null) next[a.id] = 5;
      }
      return next;
    });
  }, [question]);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoadingQuestion(false);
      return;
    }

    console.log("[QuestionDetailPage] Cargando pregunta con ID:", id, "(tipo:", typeof id, ", longitud:", id.length, ")");

    setLoadingQuestion(true);
    setNotFound(false);
    setQuestion(null);

    (async () => {
      try {
        const q = await getById(id);
        if (q) {
          console.log("[QuestionDetailPage] Pregunta encontrada:", q.id, "(tipo:", typeof q.id, ", longitud:", q.id.length, ")");
          setQuestion(q);
          setEditTitle(q.title);
          setEditDescription(q.description);
          setEditAnonymous(q.isAnonymous);
          setEditCategory(q.category);
          setEditTags([...q.tags]);
          // Verificar si está guardada/seguida
          if (user) {
            setIsSaved(await isQuestionSaved(q.id));
            setIsFollowed(await isQuestionFollowed(q.id));
          }
          setNotFound(false);
          
          // Contabilizar vista única por usuario (1 vez) - solo después de cargar la pregunta
          try {
            await registerView(id);
            // Recargar la pregunta para obtener el viewsCount actualizado
            const updatedQ = await getById(id);
            if (updatedQ) {
              setQuestion(updatedQ);
            }
          } catch {
            // ignorar (no debería pasar porque la ruta es privada)
          }
        } else {
          // Solo marcar como no encontrada si Firestore respondió y no existe
          console.warn("[QuestionDetailPage] Pregunta no encontrada para ID:", id);
          setNotFound(true);
        }
      } catch (err) {
        console.error("[QuestionDetailPage] Error cargando pregunta con ID:", id, err);
        setNotFound(true);
      } finally {
        setLoadingQuestion(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await addAnswer({ questionId: id, content, isAnonymous: answerAnonymous });
      setContent("");
      setAnswerAnonymous(false);
      const q = await getById(id);
      setQuestion(q);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo agregar la respuesta");
    } finally {
      setLoading(false);
    }
  }

  const canEditQuestion = useMemo(() => Boolean(user && question && user.id === question.authorId), [user, question]);

  async function onSaveQuestionEdit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateQuestion({
        id,
        title: editTitle,
        description: editDescription,
        isAnonymous: editAnonymous,
        category: editCategory,
        tags: editTags
      });
      const q = await getById(id);
      setQuestion(q);
      setIsEditingQuestion(false);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo editar la pregunta");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveAnswerEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingAnswerId) return;
    setError(null);
    setLoading(true);
    try {
      await updateAnswer({ questionId: id, answerId: editingAnswerId, content: editAnswerContent });
      const q = await getById(id);
      setQuestion(q);
      setEditingAnswerId(null);
      setEditAnswerContent("");
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo editar la respuesta");
    } finally {
      setLoading(false);
    }
  }

  async function onRate(a: Answer) {
    const val = ratingByAnswerId[a.id] ?? 5;
    setError(null);
    setLoading(true);
    try {
      await rateAnswer({ questionId: id, answerId: a.id, value: val });
      const q = await getById(id);
      setQuestion(q);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo calificar la respuesta");
    } finally {
      setLoading(false);
    }
  }

  async function onRateQuestion() {
    setError(null);
    setLoading(true);
    try {
      await rateQuestion({ questionId: id, value: questionRating });
      const q = await getById(id);
      setQuestion(q);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo calificar la pregunta");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitReport(e: FormEvent) {
    e.preventDefault();
    if (!question) return;
    
    setError(null);
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
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo enviar el reporte");
    } finally {
      setLoading(false);
    }
  }

  // Mostrar loading mientras se carga
  if (loadingQuestion) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  // Solo mostrar "no encontrada" si terminó de cargar Y realmente no existe
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

  // Si aún no hay pregunta pero tampoco está marcada como notFound, seguir mostrando loading
  if (!question && !notFound) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando pregunta...</p>
        </div>
      </div>
    );
  }

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
          <span>Autor: <strong>{question.isAnonymous ? "Anónimo" : question.authorName}</strong></span>
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
            onMouseEnter={(e) => {
              if (!isSaved) e.currentTarget.style.background = "#5a6268";
            }}
            onMouseLeave={(e) => {
              if (!isSaved) e.currentTarget.style.background = "#6c757d";
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
            onMouseEnter={(e) => {
              if (!isFollowed) e.currentTarget.style.background = "#5a6268";
            }}
            onMouseLeave={(e) => {
              if (!isFollowed) e.currentTarget.style.background = "#6c757d";
            }}
          >
            {isFollowed ? "🔔 Siguiendo" : "🔔 Seguir pregunta"}
          </button>
          {user && user.id !== question.authorId && (
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
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#c82333")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#dc3545")}
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
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                Motivo
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px"
                }}
              >
                <option value="spam">Spam</option>
                <option value="inappropriate">Contenido inapropiado</option>
                <option value="offensive">Ofensivo</option>
                <option value="duplicate">Duplicado</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                Descripción
              </label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                placeholder="Describe el problema..."
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit"
                }}
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

      {user && question.ratingsByUserId[user.id] == null && user.id !== question.authorId && (
        <div style={{ padding: "16px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>
              Calificar pregunta (1-5):
            </label>
            <select
              value={questionRating}
              onChange={(e) => setQuestionRating(Number(e.target.value))}
              style={{
                padding: "8px",
                fontSize: "16px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
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
              Calificar
            </button>
          </div>
        </div>
      )}

      {canEditQuestion && (
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
          {!isEditingQuestion ? (
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
          ) : (
            <form onSubmit={onSaveQuestionEdit}>
              <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Editar pregunta</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                  Título
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    border: "1px solid #ddd",
                    borderRadius: "4px"
                  }}
                  required
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                  Descripción
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontFamily: "inherit"
                  }}
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
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                  Categoría
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    border: "1px solid #ddd",
                    borderRadius: "4px"
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                  Etiquetas (selecciona entre 1 y 5)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto", padding: "10px", background: "#fff", border: "1px solid #ddd", borderRadius: "4px" }}>
                  {PREDEFINED_TAGS.map((tag) => (
                    <label key={tag} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={editTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (editTags.length < 5) {
                              setEditTags([...editTags, tag]);
                            }
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
          <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>Aún no hay respuestas. ¡Sé el primero en responder!</p>
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
                    <strong style={{ fontSize: "16px" }}>{a.isAnonymous ? "Anónimo" : a.authorName}</strong>
                    {question.trophyAnswerId === a.id && (
                      <span style={{ padding: "4px 8px", background: "#ffc107", color: "#000", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                        🏆 Mejor aporte
                      </span>
                    )}
                    <span style={{ color: "#666", fontSize: "14px" }}>
                      ⭐ {formatStars(a.ratingAvg)} ({a.ratingAvg.toFixed(1)})
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {user?.id === a.authorId && editingAnswerId !== a.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnswerId(a.id);
                          setEditAnswerContent(a.content);
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        ✏️ Editar
                      </button>
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
                        style={{
                          padding: "6px 12px",
                          background: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
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
                      style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: "16px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontFamily: "inherit",
                        marginBottom: "10px"
                      }}
                      required
                    />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="submit"
                        disabled={loading}
                        style={{
                          padding: "8px 16px",
                          background: loading ? "#ccc" : "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontSize: "14px",
                          fontWeight: "bold"
                        }}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnswerId(null);
                          setEditAnswerContent("");
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold"
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <p style={{ margin: 0, fontSize: "16px", lineHeight: "1.6", whiteSpace: "pre-wrap", marginBottom: "12px" }}>{a.content}</p>
                )}
                {user && a.ratingsByUserId[user.id] == null && user.id !== a.authorId && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                    <label style={{ fontSize: "14px", fontWeight: "bold" }}>
                      Calificar (1-5):
                    </label>
                    <select
                      value={ratingByAnswerId[a.id] ?? 5}
                      onChange={(e) => setRatingByAnswerId((prev) => ({ ...prev, [a.id]: Number(e.target.value) }))}
                      style={{
                        padding: "6px",
                        fontSize: "14px",
                        border: "1px solid #ddd",
                        borderRadius: "4px"
                      }}
                    >
                      {ratingOptions(1).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onRate(a)}
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
                      Calificar
                    </button>
                    <span style={{ fontSize: "14px", color: "#666" }}>
                      Votos: {a.ratingCount} {a.ratingsByUserId[user.id] != null ? `· Tu voto: ${a.ratingsByUserId[user.id]}` : ""}
                    </span>
                  </div>
                )}
                {user && a.ratingsByUserId[user.id] != null && (
                  <div style={{ paddingTop: "12px", borderTop: "1px solid #eee", fontSize: "14px", color: "#666" }}>
                    Votos: {a.ratingCount} · Tu voto: {a.ratingsByUserId[user.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>Agregar respuesta</h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              Tu respuesta
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Escribe tu respuesta aquí..."
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit"
              }}
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
      </div>
    </div>
  );
}


