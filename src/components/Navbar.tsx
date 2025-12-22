import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useNotifications } from "../app/providers/NotificationsProvider";
import type { Notification } from "../domain/notifications";

export function Navbar() {
  const { user, logout } = useAuth();
  const { reset } = useQuestions();
  const { notifications, unreadCount, markRead, markAllRead, reset: resetNotifications } = useNotifications();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  async function onLogout() {
    reset();
    resetNotifications();
    await logout();
    navigate("/", { replace: true });
  }

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showNotifications]);

  function getNotificationText(notification: Notification): string {
    switch (notification.type) {
      case "question/new-answer":
        return "Nueva respuesta en tu pregunta";
      case "answer/rated":
        if ("rating" in notification.data) {
          return `Tu respuesta fue calificada con ${notification.data.rating} estrellas`;
        }
        return "Tu respuesta fue calificada";
      case "reputation/level-up":
        if ("level" in notification.data) {
          return `¡Subiste al nivel ${notification.data.level}!`;
        }
        return "Subiste de nivel";
      case "reputation/rank-up":
        if ("rank" in notification.data) {
          return `¡Alcanzaste el rango ${notification.data.rank}!`;
        }
        return "Subiste de rango";
      default:
        return "Nueva notificación";
    }
  }

  function getNotificationLink(notification: Notification): string {
    if (notification.type === "question/new-answer" || notification.type === "answer/rated") {
      if ("questionId" in notification.data) {
        const questionId = notification.data.questionId;
        if ("answerId" in notification.data) {
          return `/question/${questionId}#answer-${notification.data.answerId}`;
        }
        return `/question/${questionId}`;
      }
    }
    return "/profile";
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.readAt) {
      await markRead(notification.id);
    }
    setShowNotifications(false);
    const link = getNotificationLink(notification);
    navigate(link);
  }

  function handleToggleNotifications() {
    setShowNotifications(!showNotifications);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} ${diffMins === 1 ? "minuto" : "minutos"}`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  return (
    <nav
      aria-label="Navegación"
      style={{
        background: "#fff",
        borderBottom: "2px solid #007bff",
        padding: "16px 20px",
        marginBottom: "20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            to="/home"
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#007bff",
              textDecoration: "none"
            }}
          >
            COMPTION
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }} ref={notificationsRef}>
            <button
              type="button"
              onClick={handleToggleNotifications}
              style={{
                position: "relative",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "20px",
                color: "#007bff",
                borderRadius: "6px",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="Notificaciones"
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "#dc3545",
                    color: "white",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: "1"
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "0",
                  marginTop: "8px",
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  minWidth: "320px",
                  maxWidth: "400px",
                  maxHeight: "500px",
                  overflowY: "auto",
                  zIndex: 1000
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#f9f9f9",
                    borderTopLeftRadius: "8px",
                    borderTopRightRadius: "8px"
                  }}
                >
                  <strong style={{ fontSize: "16px", color: "#333" }}>Notificaciones</strong>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      style={{
                        padding: "4px 8px",
                        background: "transparent",
                        border: "1px solid #007bff",
                        color: "#007bff",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}>
                    No hay notificaciones
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                          background: notification.readAt ? "#fff" : "#f0f8ff",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = notification.readAt ? "#f5f5f5" : "#e6f3ff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = notification.readAt ? "#fff" : "#f0f8ff";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          {!notification.readAt && (
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "#007bff",
                                marginTop: "6px",
                                flexShrink: 0
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: notification.readAt ? "normal" : "bold",
                                color: "#333",
                                marginBottom: "4px"
                              }}
                            >
                              {getNotificationText(notification)}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              {formatDate(notification.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link
              to="/home"
              style={{
                padding: "8px 16px",
                color: "#007bff",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Inicio
            </Link>
            <Link
              to="/explore"
              style={{
                padding: "8px 16px",
                color: "#007bff",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Explorar
            </Link>
            <Link
              to="/ask"
              style={{
                padding: "8px 16px",
                color: "#007bff",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Preguntar
            </Link>
            <Link
              to="/profile"
              style={{
                padding: "8px 16px",
                color: "#007bff",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Perfil
            </Link>
            <Link
              to="/help"
              style={{
                padding: "8px 16px",
                color: "#007bff",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e7f3ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Ayuda
            </Link>
            {user?.role === "ADMIN" && (
              <Link
                to="/admin"
                style={{
                  padding: "8px 16px",
                  color: "#dc3545",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe7e7")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: "8px 16px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#c82333")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#dc3545")}
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}


