import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px", textAlign: "center" }}>
      <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h1 style={{ fontSize: "72px", fontWeight: "bold", marginBottom: "20px", color: "#dc3545" }}>404</h1>
        <p style={{ fontSize: "24px", marginBottom: "30px", color: "#666" }}>Esta página no existe.</p>
        <Link
          to="/"
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
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}



