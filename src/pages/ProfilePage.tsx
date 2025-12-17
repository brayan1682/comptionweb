import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useNotifications } from "../app/providers/NotificationsProvider";
import { useReputation } from "../app/providers/ReputationProvider";
import { useUserData } from "../app/providers/UserDataProvider";
import { ServiceError } from "../services/errors";
import { xpForNextLevel } from "../services/reputation/reputationUtils";

export function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const { listMyQuestions, listMyAnswers, reset: resetQuestions } = useQuestions();
  const { notifications, unreadCount, markRead, markAllRead, refresh: refreshNotifications, reset: resetNotifications } =
    useNotifications();
  const { reputation, refresh: refreshReputation } = useReputation();
  const { getSavedQuestions, getFollowedQuestions } = useUserData(); // corregido
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myQuestions, setMyQuestions] = useState<Array<{ id: string; title: string }>>([]);
  const [myAnswers, setMyAnswers] = useState<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>>([]);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [followedQuestionIds, setFollowedQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    (async () => {
      if (!user) return;

      const qs = await listMyQuestions();
      setMyQuestions(qs.map((q) => ({ id: q.id, title: q.title })));

      const ans = await listMyAnswers();
      setMyAnswers(ans);

      const saved = await getSavedQuestions(); // corregido
      setSavedQuestionIds(saved);

      const followed = await getFollowedQuestions(); // corregido
      setFollowedQuestionIds(followed);

      await refreshNotifications();
      await refreshReputation();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ name });
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  }

  function formatNotification(nType: string) {
    if (nType === "question/new-answer") return "Nueva respuesta en una de tus preguntas";
    if (nType === "answer/rated") return "Calificaron una de tus respuestas";
    return nType;
  }

  async function onLogout() {
    resetQuestions();
    resetNotifications();
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div>
      <h1>Perfil</h1>
      <h2>Información no editable</h2>
      <p>
        <strong>Email:</strong> {user?.email}
      </p>
      <p>
        <strong>Rol:</strong> {user?.role}
      </p>

      <h2>Información editable</h2>
      <form onSubmit={onSave}>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>

      <h2>Estadísticas y Reputación</h2>
      {reputation ? (
        <div>
          <p>
            <strong>Nivel:</strong> {reputation.level}
          </p>
          <p>
            <strong>Rango:</strong> {reputation.rank}
          </p>
          <p>
            <strong>XP Total:</strong> {reputation.xp}
          </p>
          <p>
            <strong>XP para siguiente nivel:</strong>{" "}
            {xpForNextLevel(reputation.level) - reputation.xp > 0
              ? xpForNextLevel(reputation.level) - reputation.xp
              : "¡Nivel máximo alcanzado!"}
          </p>
          <p>
            <strong>Trofeos obtenidos:</strong> {reputation.trophiesCount}
          </p>
        </div>
      ) : (
        <p>No hay datos de reputación aún.</p>
      )}
      <p>
        <strong>Preguntas realizadas:</strong> {myQuestions.length}
      </p>
      <p>
        <strong>Respuestas dadas:</strong> {myAnswers.length}
      </p>

      <h2>Preguntas guardadas</h2>
      {savedQuestionIds.length === 0 ? <p>No has guardado preguntas.</p> : null}
      <ul>
        {savedQuestionIds.map((qId) => (
          <li key={qId}>
            <Link to={`/question/${qId}`}>Ver pregunta guardada</Link>
          </li>
        ))}
      </ul>

      <h2>Preguntas seguidas</h2>
      {followedQuestionIds.length === 0 ? <p>No sigues ninguna pregunta.</p> : null}
      <ul>
        {followedQuestionIds.map((qId) => (
          <li key={qId}>
            <Link to={`/question/${qId}`}>Ver pregunta seguida</Link>
          </li>
        ))}
      </ul>

      <h2>Actividad</h2>
      <h3>Mis preguntas</h3>
      {myQuestions.length === 0 ? <p>No has creado preguntas.</p> : null}
      <ul>
        {myQuestions.map((q) => (
          <li key={q.id}>
            <Link to={`/question/${q.id}`}>{q.title}</Link>
          </li>
        ))}
      </ul>

      <h3>Mis respuestas</h3>
      {myAnswers.length === 0 ? <p>No has publicado respuestas.</p> : null}
      <ul>
        {myAnswers.map((a) => (
          <li key={a.answerId}>
            <Link to={`/question/${a.questionId}#answer-${a.answerId}`}>Ver mi respuesta</Link> · {a.content}
          </li>
        ))}
      </ul>

      <h2>Notificaciones</h2>
      <p>Sin leer: {unreadCount}</p>
      <button type="button" onClick={() => markAllRead()}>
        Marcar todas como leídas
      </button>
      {notifications.length === 0 ? <p>No tienes notificaciones.</p> : null}
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            <p>
              <strong>{formatNotification(n.type)}</strong> · {n.readAt ? "Leída" : "No leída"}
            </p>
            {"questionId" in n.data ? (
              <p>
                <Link to={`/question/${n.data.questionId}#answer-${n.data.answerId}`}>Ver detalle</Link>
              </p>
            ) : null}
            {!n.readAt ? (
              <button type="button" onClick={() => markRead(n.id)}>
                Marcar como leída
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <h2>Sesión</h2>
      <button type="button" onClick={onLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}
