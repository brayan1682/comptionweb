import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "../app/providers/UserDataProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import type { Question } from "../domain/types";

export function FollowedQuestionsPage() {
  const { getFollowedQuestions } = useUserData();
  const { getById } = useQuestions();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const followedIds = await getFollowedQuestions();
        
        // Cargar detalles de cada pregunta
        const questionsPromises = followedIds.map((id) => getById(id));
        const questionsResults = await Promise.all(questionsPromises);
        const validQuestions = questionsResults.filter((q): q is Question => q !== null);
        
        setQuestions(validQuestions);
      } catch (err: any) {
        console.error("[FollowedQuestionsPage] Error cargando preguntas seguidas:", err);
        setError("No se pudieron cargar las preguntas seguidas");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <h1 style={{ marginBottom: "30px", fontSize: "28px", fontWeight: "bold" }}>Preguntas Seguidas</h1>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <h1 style={{ marginBottom: "30px", fontSize: "28px", fontWeight: "bold" }}>Preguntas Seguidas</h1>
        <div style={{ padding: "20px", background: "#f8d7da", color: "#721c24", borderRadius: "8px", border: "1px solid #f5c6cb" }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "30px", fontSize: "28px", fontWeight: "bold" }}>Preguntas Seguidas</h1>
      
      {questions.length === 0 ? (
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666", marginBottom: "10px" }}>🔔 No estás siguiendo ninguna pregunta</p>
          <p style={{ fontSize: "14px", color: "#999" }}>
            Cuando sigas una pregunta, recibirás notificaciones cuando alguien responda o califique.
          </p>
          <Link
            to="/explore"
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "12px 24px",
              background: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "bold"
            }}
          >
            Explorar Preguntas
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {questions.map((question) => (
            <div
              key={question.id}
              style={{
                padding: "20px",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #ddd",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                transition: "box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
              }}
            >
              <Link
                to={`/question/${question.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit"
                }}
              >
                <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "bold", color: "#007bff" }}>
                  {question.title}
                </h2>
              </Link>
              
              <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#666", lineHeight: "1.6" }}>
                {question.description.length > 150
                  ? `${question.description.substring(0, 150)}...`
                  : question.description}
              </p>
              
              <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", fontSize: "14px", color: "#999" }}>
                <span>💬 {question.answers.length} respuestas</span>
                <span>👁️ {question.viewsCount} vistas</span>
                <span>⭐ {question.ratingAvg.toFixed(1)} ({question.ratingCount})</span>
                <span>📅 {new Date(question.createdAt).toLocaleDateString()}</span>
                {question.category && <span>🏷️ {question.category}</span>}
              </div>
              
              <div style={{ marginTop: "12px" }}>
                <Link
                  to={`/question/${question.id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    background: "#007bff",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  Ver pregunta →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}










