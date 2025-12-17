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
    <div>
      <h1>Hacer pregunta</h1>
      {showPreventiveSearch ? (
        <div>
          <h2>Buscador preventivo</h2>
          <p>Antes de crear una nueva pregunta, busca si ya existe una similar:</p>
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar preguntas similares..."
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
          <div>
            <label>
              Filtros:
              <select value={searchFilter} onChange={(e) => setSearchFilter(e.target.value as any)}>
                <option value="all">Todas</option>
                <option value="no-answers">Sin respuestas</option>
                <option value="best-rated">Mejor calificadas</option>
                <option value="recent">Más recientes</option>
              </select>
            </label>
          </div>
          {suggestedQuestions.length > 0 ? (
            <div>
              <h3>Preguntas similares encontradas ({suggestedQuestions.length}):</h3>
              <ul>
                {suggestedQuestions.map((q) => (
                  <li key={q.id}>
                    <Link to={`/question/${q.id}`} onClick={() => handleUseSuggestion(q)}>
                      {q.title}
                    </Link>
                    <span> · {q.answers.length} respuestas · Calificación: {q.ratingAvg.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : searchQuery.trim() ? (
            <p>No se encontraron preguntas similares. Puedes continuar creando tu pregunta.</p>
          ) : null}
          <button type="button" onClick={() => setShowPreventiveSearch(false)}>
            Continuar creando pregunta
          </button>
        </div>
      ) : null}
      {!showPreventiveSearch || suggestedQuestions.length === 0 ? (
        <form onSubmit={onSubmit}>
        <div>
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: No me abre VS Code" />
          </label>
        </div>
        <div>
          <label>
            Descripción
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe el problema y qué intentaste..."
            />
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} /> Publicar como anónimo
          </label>
        </div>
        <div>
          <label>
            Categoría (obligatoria)
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
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
            Etiquetas (selecciona entre 1 y 5)
            <div>
              {PREDEFINED_TAGS.map((tag) => (
                <label key={tag} style={{ display: "block" }}>
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
                  />
                  {tag}
                </label>
              ))}
            </div>
            <p>Seleccionadas: {selectedTags.length} / 5</p>
          </label>
        </div>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Publicando..." : "Publicar"}
          </button>
        </form>
      ) : null}
    </div>
  );
}


