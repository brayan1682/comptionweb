import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";
import { ServiceError } from "../services/errors";
import { CATEGORIES, PREDEFINED_TAGS } from "../services/categories/categoriesData";
import type { Question } from "../domain/types";

export function AskPage() {
  const { createQuestion, questions, refresh } = useQuestions();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreventiveSearch, setShowPreventiveSearch] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "no-answers" | "best-rated" | "recent">("all");
  const [suggestedQuestions, setSuggestedQuestions] = useState<Question[]>([]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestedQuestions([]);
      return;
    }

    let filtered = questions.filter((q) => {
      const query = searchQuery.toLowerCase();
      return q.title.toLowerCase().includes(query) || q.description.toLowerCase().includes(query);
    });

    // Aplicar filtros adicionales
    if (searchFilter === "no-answers") {
      filtered = filtered.filter((q) => q.answers.length === 0);
    } else if (searchFilter === "best-rated") {
      filtered = filtered.filter((q) => q.ratingAvg >= 4);
    } else if (searchFilter === "recent") {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((q) => new Date(q.createdAt) >= oneWeekAgo);
    }

    // Ordenar por relevancia (más respuestas y mejor calificadas primero)
    filtered.sort((a, b) => {
      const scoreA = a.answers.length * 2 + a.ratingAvg * 3;
      const scoreB = b.answers.length * 2 + b.ratingAvg * 3;
      return scoreB - scoreA;
    });

    setSuggestedQuestions(filtered.slice(0, 10)); // Máximo 10 sugerencias
  }, [searchQuery, searchFilter, questions]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (selectedTags.length < 1 || selectedTags.length > 5) {
        setError("Debes seleccionar entre 1 y 5 etiquetas");
        setLoading(false);
        return;
      }
      const q = await createQuestion({ title, description, isAnonymous, category, tags: selectedTags });
      navigate(`/question/${q.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo crear la pregunta");
    } finally {
      setLoading(false);
    }
  }

  function handleUseSuggestion(suggested: Question) {
    navigate(`/question/${suggested.id}`, { replace: true });
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>Hacer pregunta</h1>
      {showPreventiveSearch ? (
        <div style={{ marginBottom: "30px", padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
          <h2 style={{ marginBottom: "10px" }}>Buscador preventivo</h2>
          <p style={{ marginBottom: "15px" }}>Antes de crear una nueva pregunta, busca si ya existe una similar:</p>
          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar preguntas similares..."
              style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Filtros:
            </label>
            <select
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value as any)}
              style={{ padding: "8px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
            >
              <option value="all">Todas</option>
              <option value="no-answers">Sin respuestas</option>
              <option value="best-rated">Mejor calificadas</option>
              <option value="recent">Más recientes</option>
            </select>
          </div>
          {suggestedQuestions.length > 0 ? (
            <div style={{ marginBottom: "15px" }}>
              <h3 style={{ marginBottom: "10px" }}>Preguntas similares encontradas ({suggestedQuestions.length}):</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {suggestedQuestions.map((q) => (
                  <li key={q.id} style={{ marginBottom: "10px", padding: "10px", background: "#fff", borderRadius: "4px", border: "1px solid #ddd" }}>
                    <Link to={`/question/${q.id}`} onClick={() => handleUseSuggestion(q)} style={{ fontWeight: "bold", textDecoration: "none", color: "#007bff" }}>
                      {q.title}
                    </Link>
                    <span style={{ color: "#666", marginLeft: "10px" }}> · {q.answers.length} respuestas · Calificación: {q.ratingAvg.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : searchQuery.trim() ? (
            <p style={{ marginBottom: "15px", color: "#28a745" }}>No se encontraron preguntas similares. Puedes continuar creando tu pregunta.</p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPreventiveSearch(false)}
            style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Continuar creando pregunta
          </button>
        </div>
      ) : null}
      {!showPreventiveSearch || suggestedQuestions.length === 0 ? (
        <form onSubmit={onSubmit} style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Título
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: No me abre VS Code"
              style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
              required
            />
            <small style={{ color: "#666" }}>Mínimo 8 caracteres</small>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe el problema y qué intentaste..."
              style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px", fontFamily: "inherit" }}
              required
            />
            <small style={{ color: "#666" }}>Mínimo 10 caracteres</small>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
              Publicar como anónimo
            </label>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Categoría (obligatoria)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px", fontSize: "16px", border: "1px solid #ddd", borderRadius: "4px" }}
              required
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Etiquetas (selecciona entre 1 y 5)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", maxHeight: "200px", overflowY: "auto", padding: "10px", background: "#fff", border: "1px solid #ddd", borderRadius: "4px" }}>
              {PREDEFINED_TAGS.map((tag) => (
                <label key={tag} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (selectedTags.length < 5) {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      } else {
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      }
                    }}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
            <p style={{ marginTop: "10px", color: selectedTags.length >= 1 && selectedTags.length <= 5 ? "#28a745" : "#dc3545", fontWeight: "bold" }}>
              Seleccionadas: {selectedTags.length} / 5
            </p>
          </div>
          {error ? (
            <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading || selectedTags.length < 1 || selectedTags.length > 5}
            style={{
              padding: "12px 24px",
              background: loading || selectedTags.length < 1 || selectedTags.length > 5 ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading || selectedTags.length < 1 || selectedTags.length > 5 ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {loading ? "Publicando..." : "Publicar Pregunta"}
          </button>
        </form>
      ) : null}
    </div>
  );
}


