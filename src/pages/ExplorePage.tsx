import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { useAuth } from "../app/providers/AuthProvider";
import type { Question } from "../domain/types";
import { CATEGORIES } from "../services/categories/categoriesData";

export type ExploreFilter =
  | "most-viewed"
  | "no-answers"
  | "best-rated"
  | "most-answers"
  | "trending-day"
  | "trending-week"
  | "trending-month"
  | "trending-year";

export function ExplorePage() {
  const { questions, refresh } = useQuestions();
  const { user } = useAuth();
  const [filter, setFilter] = useState<ExploreFilter>("most-viewed");
  const [category, setCategory] = useState<string>("all");
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);

  useEffect(() => {
    // Refrescar siempre desde Firestore al cargar la página
    // Esto asegura que no haya datos stale
    if (user) {
      console.log("[ExplorePage] Usuario autenticado, refrescando questions desde Firestore");
      refresh().catch(error => {
        console.error("[ExplorePage] Error refrescando questions:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Refrescar cuando cambia el usuario

  useEffect(() => {
    let filtered = [...questions];

    // Filtrar por categoría
    if (category !== "all") {
      filtered = filtered.filter((q) => q.category === category);
    }

    // Aplicar filtro de ordenamiento
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case "most-viewed":
        filtered.sort((a, b) => {
          if (a.viewsCount !== b.viewsCount) return b.viewsCount - a.viewsCount;
          return a.createdAt < b.createdAt ? 1 : -1;
        });
        break;
      case "no-answers":
        filtered = filtered.filter((q) => q.answers.length === 0);
        filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        break;
      case "best-rated":
        filtered.sort((a, b) => {
          if (a.ratingAvg !== b.ratingAvg) return b.ratingAvg - a.ratingAvg;
          if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount;
          return a.createdAt < b.createdAt ? 1 : -1;
        });
        break;
      case "most-answers":
        filtered.sort((a, b) => {
          if (a.answers.length !== b.answers.length) return b.answers.length - a.answers.length;
          return a.createdAt < b.createdAt ? 1 : -1;
        });
        break;
      case "trending-day":
        filtered = filtered.filter((q) => new Date(q.createdAt) >= oneDayAgo);
        filtered.sort((a, b) => {
          const scoreA = a.viewsCount + a.answers.length * 2 + a.ratingAvg * 3;
          const scoreB = b.viewsCount + b.answers.length * 2 + b.ratingAvg * 3;
          return scoreB - scoreA;
        });
        break;
      case "trending-week":
        filtered = filtered.filter((q) => new Date(q.createdAt) >= oneWeekAgo);
        filtered.sort((a, b) => {
          const scoreA = a.viewsCount + a.answers.length * 2 + a.ratingAvg * 3;
          const scoreB = b.viewsCount + b.answers.length * 2 + b.ratingAvg * 3;
          return scoreB - scoreA;
        });
        break;
      case "trending-month":
        filtered = filtered.filter((q) => new Date(q.createdAt) >= oneMonthAgo);
        filtered.sort((a, b) => {
          const scoreA = a.viewsCount + a.answers.length * 2 + a.ratingAvg * 3;
          const scoreB = b.viewsCount + b.answers.length * 2 + b.ratingAvg * 3;
          return scoreB - scoreA;
        });
        break;
      case "trending-year":
        filtered = filtered.filter((q) => new Date(q.createdAt) >= oneYearAgo);
        filtered.sort((a, b) => {
          const scoreA = a.viewsCount + a.answers.length * 2 + a.ratingAvg * 3;
          const scoreB = b.viewsCount + b.answers.length * 2 + b.ratingAvg * 3;
          return scoreB - scoreA;
        });
        break;
    }

    setFilteredQuestions(filtered);
  }, [questions, filter, category]);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "30px", fontSize: "28px", fontWeight: "bold" }}>Explorar / Descubrir</h1>
      
      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "30px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
              Filtrar por categoría:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "#fff"
              }}
            >
              <option value="all">Todas las categorías</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
              Criterio de ordenamiento:
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ExploreFilter)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "#fff"
              }}
            >
              <option value="most-viewed">Preguntas más vistas</option>
              <option value="no-answers">Sin respuesta</option>
              <option value="best-rated">Mejor calificadas</option>
              <option value="most-answers">Con más respuestas</option>
              <option value="trending-day">Tendencias (Día)</option>
              <option value="trending-week">Tendencias (Semana)</option>
              <option value="trending-month">Tendencias (Mes)</option>
              <option value="trending-year">Tendencias (Año)</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "20px", fontWeight: "bold" }}>
          Resultados ({filteredQuestions.length})
        </h2>
        {filteredQuestions.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>No hay preguntas que coincidan con los filtros.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredQuestions.map((q) => (
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
                  <span>·</span>
                  <span>⭐ {q.ratingAvg.toFixed(1)}</span>
                  <span>·</span>
                  <span style={{ padding: "2px 8px", background: "#e7f3ff", borderRadius: "4px", color: "#007bff", fontWeight: "500" }}>
                    {q.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

