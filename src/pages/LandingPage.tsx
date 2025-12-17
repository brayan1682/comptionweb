import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function LandingPage() {
  const { user, isReady } = useAuth();
  if (!isReady) return <p>Cargando...</p>;
  if (user) return <Navigate to="/home" replace />;

  return (
    <div>
      <h1>Comption</h1>
      <p>Plataforma de preguntas y respuestas sobre tecnología.</p>
      <ul>
        <li>
          <Link to="/login">Iniciar sesión</Link>
        </li>
        <li>
          <Link to="/register">Registrarse</Link>
        </li>
      </ul>
    </div>
  );
}



