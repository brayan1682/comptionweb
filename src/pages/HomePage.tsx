import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useAuth } from "../app/providers/AuthProvider";

export function HomePage() {
  const { questions, refresh } = useQuestions();
  const { user } = useAuth();

  useEffect(() => {
    // Refrescar siempre desde Firestore al cargar la página
    // Esto asegura que no haya datos stale
    if (user) {
      console.log("[HomePage] Usuario autenticado, refrescando questions desde Firestore");
      refresh().catch(error => {
        console.error("[HomePage] Error refrescando questions:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Refrescar cuando cambia el usuario

  const sorted = [...questions].sort((a, b) => {
    if (a.viewsCount !== b.viewsCount) return b.viewsCount - a.viewsCount;
    // desempate: más reciente primero
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>Preguntas más vistas</h1>
        <Link
          to="/ask"
          style={{
            padding: "12px 24px",
            background: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "16px",
            transition: "background 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0056b3")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#007bff")}
        >
          + Hacer una pregunta
        </Link>
      </div>

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "20px", fontWeight: "bold" }}>Listado de preguntas</h2>
        {questions.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>No hay preguntas todavía.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sorted.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: "16px",
                  background: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  transition: "box-shadow 0.2s, transform 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <Link
                  to={`/question/${q.id}`}
                  onClick={() => {
                    console.log("[HomePage] Click en pregunta:");
                    console.log("[HomePage] q.id:", JSON.stringify(q.id));
                    console.log("[HomePage] URL:", `/question/${q.id}`);
                  }}
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#007bff",
                    textDecoration: "none",
                    display: "block",
                    marginBottom: "8px"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  {q.title}
                </Link>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "14px", color: "#666" }}>
                  <span>
                    {q.answers.length} {q.answers.length === 1 ? "respuesta" : "respuestas"}
                  </span>
                  <span>·</span>
                  <span>Autor: {q.isAnonymous ? "Anónimo" : q.authorName}</span>
                  <span>·</span>
                  <span>{q.viewsCount} vistas</span>
                  {q.ratingAvg > 0 && (
                    <>
                      <span>·</span>
                      <span>⭐ {q.ratingAvg.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


