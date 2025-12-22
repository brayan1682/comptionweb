import { Link } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function WelcomePage() {
  const { user } = useAuth();
  
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ padding: "40px", background: "linear-gradient(135deg, #007bff 0%, #0056b3 100%)", borderRadius: "8px", textAlign: "center", marginBottom: "30px", color: "white" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "20px" }}>
          ¡Bienvenido a Comption! 🎯
        </h1>
        <p style={{ fontSize: "20px", marginBottom: "20px", lineHeight: "1.6" }}>
          <strong>Tu viaje comienza ahora</strong>
        </p>
        {user && (
          <div style={{ padding: "20px", background: "rgba(255,255,255,0.2)", borderRadius: "8px", marginTop: "20px" }}>
            <p style={{ fontSize: "18px", margin: "8px 0" }}>Nivel: <strong>{user.level || 1}</strong></p>
            <p style={{ fontSize: "18px", margin: "8px 0" }}>Rango: <strong>{user.rank || "Novato"}</strong></p>
            <p style={{ fontSize: "16px", margin: "8px 0", opacity: 0.9 }}>XP: {user.xp || 0}</p>
          </div>
        )}
        <p style={{ fontSize: "16px", marginTop: "20px", opacity: 0.9 }}>
          Bienvenido al entorno tecnológico donde las preguntas son la presa, las respuestas el arma, y el cazador es nuestra comunidad.
        </p>
      </div>

      <div style={{ padding: "30px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "30px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Estás listo para comenzar tu viaje en la plataforma. Aquí podrás:</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {[
            "Hacer preguntas sobre tecnología y recibir respuestas de la comunidad",
            "Responder preguntas y ganar reputación",
            "Calificar contenido y construir tu perfil",
            "Subir de nivel y alcanzar nuevos rangos",
            "Obtener trofeos por tus mejores aportes"
          ].map((item, index) => (
            <li
              key={index}
              style={{
                padding: "12px",
                marginBottom: "8px",
                background: "#f9f9f9",
                borderRadius: "6px",
                fontSize: "16px",
                lineHeight: "1.6"
              }}
            >
              ✓ {item}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ textAlign: "center" }}>
        <Link
          to="/home"
          style={{
            display: "inline-block",
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
          Comenzar a explorar →
        </Link>
      </div>
    </div>
  );
}

