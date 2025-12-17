import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useNotifications } from "../app/providers/NotificationsProvider";

export function Navbar() {
  const { user, logout } = useAuth();
  const { reset } = useQuestions();
  const { unreadCount, reset: resetNotifications } = useNotifications();
  const navigate = useNavigate();

  async function onLogout() {
    reset();
    resetNotifications();
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <nav aria-label="Navegación">
      <p>
        <strong>COMPTION</strong> {user ? <span>· {user.email}</span> : null}
      </p>
      <p>Notificaciones sin leer: {unreadCount}</p>
      <ul>
        <li>
          <Link to="/home">Preguntas más vistas</Link>
        </li>
        <li>
          <Link to="/explore">Explorar</Link>
        </li>
        <li>
          <Link to="/ask">Hacer pregunta</Link>
        </li>
        <li>
          <Link to="/profile">Perfil</Link>
        </li>
        <li>
          <Link to="/help">Ayuda</Link>
        </li>
        {user?.role === "ADMIN" ? (
          <li>
            <Link to="/admin">Administración</Link>
          </li>
        ) : null}
        <li>
          <button type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </li>
      </ul>
      <hr />
    </nav>
  );
}


