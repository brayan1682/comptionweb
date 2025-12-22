import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReports } from "../app/providers/ReportsProvider";
import { useQuestions } from "../app/providers/QuestionsProvider";
import type { Report } from "../domain/types";
import { ServiceError } from "../services/errors";

export function AdminPage() {
  const { listPending, listAll, updateStatus } = useReports();
  const { deleteQuestion, deleteAnswer } = useQuestions();
  const [reports, setReports] = useState<Report[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshReports();
  }, [showAll]);

  async function refreshReports() {
    setLoading(true);
    setError(null);
    try {
      const list = showAll ? await listAll() : await listPending();
      setReports(list);
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudieron cargar los reportes");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(reportId: string, status: Report["status"]) {
    setLoading(true);
    setError(null);
    try {
      await updateStatus(reportId, status);
      await refreshReports();
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo actualizar el estado");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(report: Report) {
    if (!confirm(`¿Eliminar ${report.targetType === "question" ? "pregunta" : "respuesta"} reportada?`)) return;
    setLoading(true);
    setError(null);
    try {
      if (report.targetType === "question") {
        await deleteQuestion(report.targetId);
      } else {
        if (report.questionId) {
          await deleteAnswer(report.questionId, report.targetId);
        } else {
          setError("No se puede eliminar la respuesta: falta questionId en el reporte");
          setLoading(false);
          return;
        }
      }
      await handleUpdateStatus(report.id, "resolved");
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo eliminar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>Panel de Administración</h1>
        <Link
          to="/home"
          style={{
            padding: "8px 16px",
            color: "#007bff",
            textDecoration: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e7f3ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          ← Volver
        </Link>
      </div>

      <div style={{ padding: "16px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          style={{
            padding: "10px 20px",
            background: showAll ? "#6c757d" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          {showAll ? "Mostrar solo pendientes" : "Mostrar todos"}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: "10px", marginBottom: "15px", background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
          {error}
        </div>
      )}
      {loading && (
        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>Cargando...</div>
      )}

      <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>
          Reportes {showAll ? "(Todos)" : "(Pendientes)"}
        </h2>
        {reports.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>No hay reportes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  padding: "20px",
                  background: "#fff",
                  borderRadius: "8px",
                  border: report.status === "pending" ? "2px solid #ffc107" : "1px solid #ddd"
                }}
              >
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px", fontSize: "14px" }}>
                  <span>
                    <strong>Tipo:</strong> {report.targetType === "question" ? "Pregunta" : "Respuesta"}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>ID:</strong> {report.targetId}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Motivo:</strong> {report.reason}
                  </span>
                  <span>·</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      background: report.status === "pending" ? "#ffc107" : report.status === "resolved" ? "#28a745" : "#6c757d",
                      color: report.status === "pending" ? "#000" : "#fff",
                      borderRadius: "4px",
                      fontWeight: "bold"
                    }}
                  >
                    {report.status === "pending" ? "Pendiente" : report.status === "resolved" ? "Resuelto" : "Descartado"}
                  </span>
                </div>
                <div style={{ marginBottom: "12px", padding: "12px", background: "#f9f9f9", borderRadius: "4px" }}>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6" }}>
                    <strong>Descripción:</strong> {report.description}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px", fontSize: "14px", color: "#666" }}>
                  <span>
                    <strong>Reportado por:</strong> {report.reporterId}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Fecha:</strong> {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                {report.targetType === "question" ? (
                  <Link
                    to={`/question/${report.targetId}`}
                    style={{
                      display: "inline-block",
                      marginBottom: "12px",
                      color: "#007bff",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "500"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    Ver pregunta →
                  </Link>
                ) : report.questionId ? (
                  <Link
                    to={`/question/${report.questionId}#answer-${report.targetId}`}
                    style={{
                      display: "inline-block",
                      marginBottom: "12px",
                      color: "#007bff",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "500"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    Ver respuesta →
                  </Link>
                ) : null}
                {report.status === "pending" && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(report.id, "resolved")}
                      disabled={loading}
                      style={{
                        padding: "8px 16px",
                        background: loading ? "#ccc" : "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        fontWeight: "bold"
                      }}
                    >
                      ✓ Marcar como resuelto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(report.id, "dismissed")}
                      disabled={loading}
                      style={{
                        padding: "8px 16px",
                        background: loading ? "#ccc" : "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        fontWeight: "bold"
                      }}
                    >
                      ✗ Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(report)}
                      disabled={loading}
                      style={{
                        padding: "8px 16px",
                        background: loading ? "#ccc" : "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        fontWeight: "bold"
                      }}
                    >
                      🗑️ Eliminar {report.targetType === "question" ? "pregunta" : "respuesta"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

