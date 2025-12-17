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
    <div>
      <h1>Panel de Administración</h1>
      <p>
        <Link to="/home">← Volver</Link>
      </p>

      <div>
        <button type="button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Mostrar solo pendientes" : "Mostrar todos"}
        </button>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Cargando...</p> : null}

      <h2>Reportes {showAll ? "(Todos)" : "(Pendientes)"}</h2>
      {reports.length === 0 ? <p>No hay reportes.</p> : null}
      <ul>
        {reports.map((report) => (
          <li key={report.id}>
            <p>
              <strong>Tipo:</strong> {report.targetType === "question" ? "Pregunta" : "Respuesta"} · <strong>ID:</strong>{" "}
              {report.targetId} · <strong>Motivo:</strong> {report.reason} · <strong>Estado:</strong> {report.status}
            </p>
            <p>
              <strong>Descripción:</strong> {report.description}
            </p>
            <p>
              <strong>Reportado por:</strong> {report.reporterId} · <strong>Fecha:</strong> {new Date(report.createdAt).toLocaleString()}
            </p>
            {report.targetType === "question" ? (
              <p>
                <Link to={`/question/${report.targetId}`}>Ver pregunta</Link>
              </p>
            ) : report.questionId ? (
              <p>
                <Link to={`/question/${report.questionId}#answer-${report.targetId}`}>Ver respuesta</Link>
              </p>
            ) : null}
            {report.status === "pending" ? (
              <div>
                <button type="button" onClick={() => handleUpdateStatus(report.id, "resolved")} disabled={loading}>
                  Marcar como resuelto
                </button>
                <button type="button" onClick={() => handleUpdateStatus(report.id, "dismissed")} disabled={loading}>
                  Descartar
                </button>
                <button type="button" onClick={() => handleDelete(report)} disabled={loading}>
                  Eliminar {report.targetType === "question" ? "pregunta" : "respuesta"}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

