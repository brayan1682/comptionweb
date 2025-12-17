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
  const { id = "" } = useParams();
  const { getById, addAnswer, registerView, updateQuestion, updateAnswer, rateAnswer, rateQuestion } = useQuestions();
  const { user } = useAuth();
  const { saveQuestion, unsaveQuestion, isQuestionSaved, followQuestion, unfollowQuestion, isQuestionFollowed } = useUserData();

  const [question, setQuestion] = useState<Question | null>(null);
  const [content, setContent] = useState("");
  const [answerAnonymous, setAnswerAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    (async () => {
      const q = await getById(id);
      setQuestion(q);
      if (q) {
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
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Contabilizar vista única por usuario (1 vez)
    (async () => {
      try {
        await registerView(id);
        const q = await getById(id);
        setQuestion(q);
      } catch {
        // ignorar (no debería pasar porque la ruta es privada)
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

  if (!question) {
    return (
      <div>
        <p>Pregunta no encontrada.</p>
        <p>
          <Link to="/home">Volver</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/home">← Volver</Link>
      </p>
      <h1>{question.title}</h1>
      <p>
        Autor: {question.isAnonymous ? "Anónimo" : question.authorName} · {question.answers.length}{" "}
        {question.answers.length === 1 ? "respuesta" : "respuestas"} · Vistas: {question.viewsCount}
      </p>
      <p>{question.description}</p>
      <p>
        <strong>Etiquetas:</strong> {question.tags.join(", ")}
      </p>
      <div>
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
        >
          {isFollowed ? "🔔 Siguiendo" : "🔔 Seguir pregunta"}
        </button>
        {user && user.id !== question.authorId ? (
          <button
            type="button"
            onClick={() => {
              setShowReportForm(true);
              setReportingAnswerId(null);
              setReportReason("spam");
              setReportDescription("");
            }}
          >
            ⚠️ Reportar pregunta
          </button>
        ) : null}
      </div>
      {showReportForm ? (
        <div>
          <h3>Reportar {reportingAnswerId ? "respuesta" : "pregunta"}</h3>
          <form onSubmit={onSubmitReport}>
            <div>
              <label>
                Motivo
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value as any)}>
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Contenido inapropiado</option>
                  <option value="offensive">Ofensivo</option>
                  <option value="duplicate">Duplicado</option>
                  <option value="other">Otro</option>
                </select>
              </label>
            </div>
            <div>
              <label>
                Descripción
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe el problema..."
                />
              </label>
            </div>
            <button type="submit" disabled={loading || !reportDescription.trim()}>
              Enviar reporte
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReportForm(false);
                setReportingAnswerId(null);
                setReportDescription("");
              }}
            >
              Cancelar
            </button>
          </form>
        </div>
      ) : null}

      <div>
        <p>
          Calificación: {formatStars(question.ratingAvg)} ({question.ratingAvg}) · Votos: {question.ratingCount}
          {user && question.ratingsByUserId[user.id] != null ? ` · Tu voto: ${question.ratingsByUserId[user.id]}` : null}
        </p>
        {user && question.ratingsByUserId[user.id] == null && user.id !== question.authorId ? (
          <div>
            <label>
              Calificar pregunta (1-5):
              <select value={questionRating} onChange={(e) => setQuestionRating(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onRateQuestion} disabled={loading}>
              Calificar
            </button>
          </div>
        ) : null}
      </div>

      {canEditQuestion ? (
        <div>
          {!isEditingQuestion ? (
            <button type="button" onClick={() => setIsEditingQuestion(true)}>
              Editar pregunta
            </button>
          ) : (
            <form onSubmit={onSaveQuestionEdit}>
              <h2>Editar pregunta</h2>
              <div>
                <label>
                  Título
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </label>
              </div>
              <div>
                <label>
                  Descripción
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={6} />
                </label>
              </div>
              <div>
                <label>
                  <input type="checkbox" checked={editAnonymous} onChange={(e) => setEditAnonymous(e.target.checked)} /> Publicar
                  como anónimo
                </label>
              </div>
              <div>
                <label>
                  Categoría
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label>
                  Etiquetas (selecciona entre 1 y 5)
                  <div>
                    {PREDEFINED_TAGS.map((tag) => (
                      <label key={tag} style={{ display: "block" }}>
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
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  <p>Seleccionadas: {editTags.length} / 5</p>
                </label>
              </div>
              <button type="submit" disabled={loading}>
                Guardar cambios
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
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      ) : null}

      <h2>Respuestas</h2>
      {question.answers.length === 0 ? <p>Aún no hay respuestas.</p> : null}
      <ul>
        {question.answers.map((a) => (
          <li key={a.id} id={`answer-${a.id}`}>
            <p>
              <strong>{a.isAnonymous ? "Anónimo" : a.authorName}</strong>
              {question.trophyAnswerId === a.id ? <span> 🏆 <strong>(Mejor aporte)</strong></span> : null} · Calificación:{" "}
              {formatStars(a.ratingAvg)} ({a.ratingAvg})
            </p>
            {editingAnswerId === a.id ? (
              <form onSubmit={onSaveAnswerEdit}>
                <div>
                  <textarea value={editAnswerContent} onChange={(e) => setEditAnswerContent(e.target.value)} rows={4} />
                </div>
                <button type="submit" disabled={loading}>
                  Guardar respuesta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAnswerId(null);
                    setEditAnswerContent("");
                  }}
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <p>{a.content}</p>
            )}

            {user?.id === a.authorId && editingAnswerId !== a.id ? (
              <button
                type="button"
                onClick={() => {
                  setEditingAnswerId(a.id);
                  setEditAnswerContent(a.content);
                }}
              >
                Editar respuesta
              </button>
            ) : null}
            {user && user.id !== a.authorId ? (
              <button
                type="button"
                onClick={() => {
                  setShowReportForm(true);
                  setReportingAnswerId(a.id);
                  setReportReason("spam");
                  setReportDescription("");
                }}
              >
                ⚠️ Reportar respuesta
              </button>
            ) : null}

            <div>
              <label>
                Calificar (1-5):
                <select
                  value={ratingByAnswerId[a.id] ?? 5}
                  onChange={(e) => setRatingByAnswerId((prev) => ({ ...prev, [a.id]: Number(e.target.value) }))}
                >
                  {ratingOptions(1).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => onRate(a)} disabled={loading}>
                Calificar
              </button>
              <p>
                Votos: {a.ratingCount} · Tu voto: {a.ratingsByUserId[user?.id ?? ""] ?? "—"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <h2>Agregar respuesta</h2>
      <form onSubmit={onSubmit}>
        <div>
          <label>
            Tu respuesta
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" checked={answerAnonymous} onChange={(e) => setAnswerAnonymous(e.target.checked)} /> Publicar
            respuesta como anónimo
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar respuesta"}
        </button>
      </form>
    </div>
  );
}


