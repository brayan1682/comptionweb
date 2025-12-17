import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
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
  const [filter, setFilter] = useState<ExploreFilter>("most-viewed");
  const [category, setCategory] = useState<string>("all");
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div>
      <h1>Explorar / Descubrir</h1>
      <div>
        <label>
          Filtrar por categoría:
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Todas</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          Criterio de ordenamiento:
          <select value={filter} onChange={(e) => setFilter(e.target.value as ExploreFilter)}>
            <option value="most-viewed">Preguntas más vistas</option>
            <option value="no-answers">Sin respuesta</option>
            <option value="best-rated">Mejor calificadas</option>
            <option value="most-answers">Con más respuestas</option>
            <option value="trending-day">Tendencias (Día)</option>
            <option value="trending-week">Tendencias (Semana)</option>
            <option value="trending-month">Tendencias (Mes)</option>
            <option value="trending-year">Tendencias (Año)</option>
          </select>
        </label>
      </div>

      <h2>Resultados ({filteredQuestions.length})</h2>
      {filteredQuestions.length === 0 ? <p>No hay preguntas que coincidan con los filtros.</p> : null}
      <ul>
        {filteredQuestions.map((q) => (
          <li key={q.id}>
            <Link to={`/question/${q.id}`}>{q.title}</Link>{" "}
            <span>
              · {q.answers.length} {q.answers.length === 1 ? "respuesta" : "respuestas"}
            </span>
            <span> · Autor: {q.isAnonymous ? "Anónimo" : q.authorName}</span>
            <span> · Vistas: {q.viewsCount}</span>
            <span> · Calificación: {q.ratingAvg.toFixed(1)}</span>
            <span> · Categoría: {q.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

