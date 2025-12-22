import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function LandingPage() {
  const { user, isReady } = useAuth();
  if (!isReady) return (
    <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px", textAlign: "center" }}>
      <p style={{ fontSize: "18px", color: "#666" }}>Cargando...</p>
    </div>
  );
  if (user) return <Navigate to="/home" replace />;

  return (
    <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px", textAlign: "center" }}>
      <h1 style={{ fontSize: "48px", fontWeight: "bold", marginBottom: "20px", color: "#007bff" }}>Comption</h1>
      <p style={{ fontSize: "20px", color: "#666", marginBottom: "40px", lineHeight: "1.6" }}>
        Plataforma de preguntas y respuestas sobre tecnología.
      </p>
      <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          to="/login"
          style={{
            padding: "14px 32px",
            background: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontSize: "18px",
            fontWeight: "bold",
            transition: "background 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0056b3")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#007bff")}
        >
          Iniciar sesión
        </Link>
        <Link
          to="/register"
          style={{
            padding: "14px 32px",
            background: "#28a745",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontSize: "18px",
            fontWeight: "bold",
            transition: "background 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#218838")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#28a745")}
        >
          Registrarse
        </Link>
      </div>
    </div>
  );
}



