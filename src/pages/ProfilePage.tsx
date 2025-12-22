import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useNotifications } from "../app/providers/NotificationsProvider";
import { useReputation } from "../app/providers/ReputationProvider";
import { useUserData } from "../app/providers/UserDataProvider";
import { ServiceError } from "../services/errors";
import { questionsService } from "../services/questions/questionsService";
import { xpForNextLevel, xpRequiredForLevel, xpNeededForNextLevel, getLevelProgress } from "../services/reputation/reputationUtils";

type ProfileTab = "view" | "edit" | "password";

export function ProfilePage() {
  const { user, updateProfile, changePassword, logout, refreshUser } = useAuth();
  const { listMyQuestions, listMyAnswers, reset: resetQuestions } = useQuestions();
  const { notifications, unreadCount, markRead, markAllRead, refresh: refreshNotifications, reset: resetNotifications } =
    useNotifications();
  const { reputation, refresh: refreshReputation } = useReputation();
  const { getSavedQuestions, getFollowedQuestions } = useUserData();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ProfileTab>("view");
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  
  // Datos del perfil
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

      // Sincronizar questionsCount con las preguntas reales en Firestore
      try {
        await questionsService.syncQuestionsCount(user.id);
        // Refrescar el usuario para obtener estadísticas actualizadas desde Firestore
        await refreshUser();
      } catch (refreshError) {
        console.warn("No se pudo sincronizar estadísticas en el perfil:", refreshError);
      }

      const qs = await listMyQuestions();
      setMyQuestions(qs.map((q) => ({ id: q.id, title: q.title })));

      const ans = await listMyAnswers();
      setMyAnswers(ans);

      const saved = await getSavedQuestions();
      setSavedQuestionIds(saved);

      const followed = await getFollowedQuestions();
      setFollowedQuestionIds(followed);

      await refreshNotifications();
      await refreshReputation();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updateProfile({ name });
      setSuccess("Perfil actualizado correctamente");
      setTimeout(() => setActiveTab("view"), 1000);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    
    // Validar que las contraseñas coincidan antes de llamar a Firebase
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    
    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess("Contraseña cambiada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setPasswordSuccess(null);
        setActiveTab("view");
      }, 2000);
    } catch (err) {
      if (err instanceof ServiceError) setPasswordError(err.message);
      else setPasswordError("No se pudo cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  }

  function formatNotification(nType: string) {
    if (nType === "question/new-answer") return "Nueva respuesta en una de tus preguntas";
    if (nType === "answer/rated") return "Calificaron una de tus respuestas";
    if (nType === "reputation/level-up") return "¡Subiste de nivel!";
    if (nType === "reputation/rank-up") return "¡Subiste de rango!";
    return nType;
  }

  async function onLogout() {
    resetQuestions();
    resetNotifications();
    await logout();
    navigate("/", { replace: true });
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "30px", fontSize: "28px", fontWeight: "bold" }}>Mi Perfil</h1>
      
      {/* Tabs de navegación */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button
          type="button"
          onClick={() => setActiveTab("view")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: activeTab === "view" ? "#007bff" : "transparent",
            color: activeTab === "view" ? "white" : "#333",
            cursor: "pointer",
            borderBottom: activeTab === "view" ? "2px solid #007bff" : "none"
          }}
        >
          Ver Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: activeTab === "edit" ? "#007bff" : "transparent",
            color: activeTab === "edit" ? "white" : "#333",
            cursor: "pointer",
            borderBottom: activeTab === "edit" ? "2px solid #007bff" : "none"
          }}
        >
          Editar Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("password")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: activeTab === "password" ? "#007bff" : "transparent",
            color: activeTab === "password" ? "white" : "#333",
            cursor: "pointer",
            borderBottom: activeTab === "password" ? "2px solid #007bff" : "none"
          }}
        >
          Cambiar Contraseña
        </button>
      </div>

      {/* Tab: Ver Perfil */}
      {activeTab === "view" && (
        <div>
          <section style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
            <h2>Información Personal</h2>
            <p><strong>Nombre:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Rol:</strong> {user.role}</p>
            <p><strong>Miembro desde:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
          </section>

          <section style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Estadísticas y Reputación</h2>
            {(() => {
              // Usar datos de reputación si existen, sino usar datos del usuario con valores por defecto
              const level = reputation?.level ?? user?.level ?? 1;
              const xp = reputation?.xp ?? user?.xp ?? 0;
              const rank = reputation?.rank ?? user?.rank ?? "Novato";
              const trophiesCount = reputation?.trophiesCount ?? 0;
              
              return (
              <div>
                <div style={{ marginBottom: "24px", padding: "20px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#007bff" }}>Nivel {level}</h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: "16px", color: "#666", fontWeight: "500" }}>{rank}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#28a745" }}>{xp} XP</p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>
                        {xpNeededForNextLevel(level, xp)} XP para siguiente nivel
                      </p>
                    </div>
                  </div>
                  
                  {/* Barra de XP estilo Fortnite */}
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "#666" }}>
                      <span>Progreso al nivel {level + 1}</span>
                      <span>
                        {(() => {
                          const xpForCurrent = level > 1 ? xpRequiredForLevel(level) : 0;
                          const xpForNext = xpRequiredForLevel(level + 1);
                          const xpProgress = xp - xpForCurrent;
                          const xpNeeded = xpForNext - xpForCurrent;
                          return `${xpProgress} / ${xpNeeded}`;
                        })()}
                      </span>
                    </div>
                    <div style={{ 
                      width: "100%", 
                      height: "24px", 
                      background: "#e9ecef", 
                      borderRadius: "12px", 
                      overflow: "hidden",
                      position: "relative",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                    }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, getLevelProgress(level, xp) * 100)}%`,
                          background: "linear-gradient(90deg, #007bff 0%, #0056b3 50%, #007bff 100%)",
                          borderRadius: "12px",
                          transition: "width 0.5s ease-in-out",
                          boxShadow: "0 2px 4px rgba(0,123,255,0.3)",
                          position: "relative",
                          overflow: "hidden"
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                          animation: "shimmer 2s infinite"
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#007bff" }}>{trophiesCount}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>🏆 Trofeos</p>
                  </div>
                  <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#28a745" }}>{user?.questionsCount ?? myQuestions.length}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>❓ Preguntas</p>
                  </div>
                  <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#ffc107" }}>{user?.answersCount ?? myAnswers.length}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>💬 Respuestas</p>
                  </div>
                </div>
                
                <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}><strong>Preguntas guardadas:</strong> {savedQuestionIds.length}</p>
                  <p style={{ margin: "0", fontSize: "14px", color: "#666" }}><strong>Preguntas seguidas:</strong> {followedQuestionIds.length}</p>
                </div>
              </div>
              );
            })()}
          </section>

          <section style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
            <h2>Actividad</h2>
            <h3>Mis Preguntas ({myQuestions.length})</h3>
            {myQuestions.length === 0 ? (
              <p>No has creado preguntas.</p>
            ) : (
              <ul>
                {myQuestions.map((q) => (
                  <li key={q.id}>
                    <Link to={`/question/${q.id}`}>{q.title}</Link>
                  </li>
                ))}
              </ul>
            )}

            <h3>Mis Respuestas ({myAnswers.length})</h3>
            {myAnswers.length === 0 ? (
              <p>No has publicado respuestas.</p>
            ) : (
              <ul>
                {myAnswers.map((a) => (
                  <li key={a.answerId}>
                    <Link to={`/question/${a.questionId}#answer-${a.answerId}`}>Ver mi respuesta</Link> · {a.content.substring(0, 100)}...
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
            <h2>Notificaciones ({unreadCount} sin leer)</h2>
            <button
              type="button"
              onClick={() => markAllRead()}
              style={{
                marginBottom: "10px",
                padding: "8px 16px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              Marcar todas como leídas
            </button>
            {notifications.length === 0 ? (
              <p>No tienes notificaciones.</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} style={{ marginBottom: "10px", padding: "10px", background: n.readAt ? "#fff" : "#e3f2fd", borderRadius: "4px" }}>
                    <p><strong>{formatNotification(n.type)}</strong> · {n.readAt ? "Leída" : "No leída"}</p>
                    {"questionId" in n.data ? (
                      <p>
                        <Link to={`/question/${n.data.questionId}#answer-${n.data.answerId}`}>Ver detalle</Link>
                      </p>
                    ) : null}
                    {!n.readAt ? (
                      <button type="button" onClick={() => markRead(n.id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                        Marcar como leída
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
            <h2>Sesión</h2>
            <button type="button" onClick={onLogout} style={{ padding: "10px 20px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Cerrar sesión
            </button>
          </section>
        </div>
      )}

      {/* Tab: Editar Perfil */}
      {activeTab === "edit" && (
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
          <h2>Editar Perfil</h2>
          <form onSubmit={onSaveProfile}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Nombre
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                required
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <p><strong>Email:</strong> {user.email} (no editable)</p>
            </div>
            {error && (
              <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
                {error}
              </div>
            )}
            {success && (
              <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: "4px" }}>
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Cambiar Contraseña */}
      {activeTab === "password" && (
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
          <h2>Cambiar Contraseña</h2>
          <form onSubmit={onChangePassword}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Contraseña Actual
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                required
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
                placeholder="Repite la nueva contraseña"
                required
              />
            </div>
            {passwordError && (
              <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: "4px" }}>
                {passwordSuccess}
              </div>
            )}
            <button
              type="submit"
              disabled={changingPassword}
              style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {changingPassword ? "Cambiando..." : "Cambiar Contraseña"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
