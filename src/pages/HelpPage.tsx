import { useEffect } from "react";
import { XP_VALUES, RANKS, getXpByStars } from "../services/reputation/reputationUtils";

export function HelpPage() {
  useEffect(() => {
    // Si hay hash #xp, hacer scroll a esa sección
    if (window.location.hash === "#xp") {
      setTimeout(() => {
        const element = document.getElementById("xp-help");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, []);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "30px" }}>Ayuda</h1>

      <div style={{ padding: "30px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <p style={{ fontSize: "18px", lineHeight: "1.6", marginBottom: "20px" }}>
          Comption está pensado para que preguntar sea simple y responder sea claro.
        </p>
      </div>

      <div
        style={{
          padding: "30px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px" }}>Guía rápida:</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {[
            'Ve a "Hacer pregunta" y describe tu problema con contexto.',
            "En el detalle de la pregunta puedes agregar respuestas.",
            "Si algo falla, vuelve a intentar y revisa los mensajes de error.",
          ].map((item, index) => (
            <li
              key={index}
              style={{
                padding: "16px",
                marginBottom: "12px",
                background: "#f9f9f9",
                borderRadius: "6px",
                fontSize: "16px",
                lineHeight: "1.6",
                borderLeft: "4px solid #007bff",
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* ✅ Sección de ayuda XP */}
      <div
        id="xp-help"
        style={{
          padding: "30px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#007bff" }}>
          💎 Sistema de XP, Niveles y Rangos
        </h2>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>¿Qué es la XP?</h3>
          <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#333", marginBottom: "12px" }}>
            La XP (Experiencia) es un sistema de puntos que ganas al participar activamente en la comunidad. Cuanta más
            XP tengas, mayor será tu nivel y rango, lo que refleja tu contribución y conocimiento.
          </p>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>¿Cómo se sube de nivel?</h3>
          <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#333", marginBottom: "12px" }}>
            Los niveles se calculan automáticamente según tu XP total:
          </p>
          <ul style={{ paddingLeft: "24px", fontSize: "16px", lineHeight: "1.8" }}>
            <li>
              <strong>Nivel 1:</strong> 0-99 XP
            </li>
            <li>
              <strong>Nivel 2:</strong> 100 XP
            </li>
            <li>Cada nivel requiere más XP que el anterior (crecimiento progresivo del 10% al 15%)</li>
            <li>Cuanto más alto sea tu nivel, más XP necesitas para subir al siguiente</li>
          </ul>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>¿Qué son los rangos?</h3>
          <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#333", marginBottom: "12px" }}>
            Los rangos son títulos que reflejan tu nivel de experiencia. Hay {RANKS.length} rangos disponibles:
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            {RANKS.map((rank, index) => (
              <div
                key={rank}
                style={{
                  padding: "12px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: "0", fontSize: "14px", fontWeight: "bold", color: "#007bff" }}>{rank}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>
                  {index === 0 && "Niveles 1-5"}
                  {index === 1 && "Niveles 6-12"}
                  {index === 2 && "Niveles 13-20"}
                  {index === 3 && "Niveles 21-30"}
                  {index === 4 && "Niveles 31-42"}
                  {index === 5 && "Niveles 43-56"}
                  {index === 6 && "Niveles 57-72"}
                  {index === 7 && "Niveles 73-90"}
                  {index === 8 && "Niveles 91-110"}
                  {index === 9 && "Nivel 111+"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>¿Cómo se gana XP?</h3>
          <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#333", marginBottom: "16px" }}>
            La XP se gana <strong>únicamente cuando otros usuarios califican tu contenido</strong> (preguntas o
            respuestas). La cantidad de XP que recibes depende de cuántas estrellas (1-5) te otorguen en la calificación.
          </p>

          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "16px" }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left", border: "1px solid #ddd", fontWeight: "bold" }}>
                    Calificación Recibida
                  </th>
                  <th style={{ padding: "12px", textAlign: "center", border: "1px solid #ddd", fontWeight: "bold" }}>
                    XP Otorgada
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((stars, index) => {
                  const xp = getXpByStars(stars);
                  const starsDisplay = "⭐".repeat(stars);
                  return (
                    <tr key={stars} style={{ background: index % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                      <td style={{ padding: "12px", border: "1px solid #ddd" }}>
                        {starsDisplay} {stars} {stars === 1 ? "estrella" : "estrellas"}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          border: "1px solid #ddd",
                          fontWeight: "bold",
                          color: "#28a745",
                        }}
                      >
                        +{xp} XP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "16px", background: "#e7f3ff", borderRadius: "8px", border: "1px solid #007bff", marginBottom: "16px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px", color: "#004085" }}>
              📝 Calificación única
            </h4>
            <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#004085", margin: 0 }}>
              Cada usuario puede calificar una pregunta o respuesta <strong>solo una vez</strong>. Una vez que calificas,
              no puedes cambiar tu calificación. Por ejemplo, si te califican con <strong>5 estrellas</strong>, recibes{" "}
              <strong>{getXpByStars(5)} XP</strong>.
            </p>
          </div>

          <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#666", fontStyle: "italic", marginTop: "12px" }}>
            <strong>Importante:</strong> Esto aplica tanto para preguntas como para respuestas. Solo recibes XP cuando un
            usuario diferente a ti te califica.
          </p>
        </div>

        <div style={{ padding: "20px", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107", marginTop: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px", color: "#856404" }}>⚠️ Reglas y Límites</h3>
          <ul style={{ margin: 0, paddingLeft: "24px", fontSize: "14px", lineHeight: "1.8", color: "#856404" }}>
            <li>
              <strong>No puedes calificar tu propio contenido:</strong> No ganarás XP por calificar tus propias preguntas o respuestas.
            </li>
            <li>
              <strong>Una calificación por usuario:</strong> Cada usuario puede calificar una vez cada pregunta o respuesta. No se puede actualizar la calificación una vez enviada.
            </li>
            <li>
              <strong>No se gana XP por publicar:</strong> Publicar preguntas o respuestas no otorga XP. Solo recibes XP cuando otros usuarios califican tu contenido.
            </li>
            <li>
              <strong>Trofeos:</strong> Se otorgan automáticamente a la mejor respuesta de una pregunta (requiere al menos 3 calificaciones y otorga {XP_VALUES.TROPHY_OBTAINED} XP adicionales).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
