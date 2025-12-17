import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuestions } from "../app/providers/QuestionsProvider";

export function HomePage() {
  const { questions, refresh } = useQuestions();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...questions].sort((a, b) => {
    if (a.viewsCount !== b.viewsCount) return b.viewsCount - a.viewsCount;
    // desempate: más reciente primero
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return (
    <div>
      <h1>Preguntas más vistas</h1>
      <p>
        <Link to="/ask">Hacer una pregunta</Link>
      </p>

      <h2>Listado</h2>
      {questions.length === 0 ? <p>No hay preguntas todavía.</p> : null}
      <ul>
        {sorted.map((q) => (
          <li key={q.id}>
            <Link to={`/question/${q.id}`}>{q.title}</Link>{" "}
            <span>
              · {q.answers.length} {q.answers.length === 1 ? "respuesta" : "respuestas"}
            </span>
            <span> · Autor: {q.isAnonymous ? "Anónimo" : q.authorName}</span>
            <span> · Vistas: {q.viewsCount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


