export function HelpPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "30px" }}>Ayuda</h1>
      
      <div style={{ padding: "30px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <p style={{ fontSize: "18px", lineHeight: "1.6", marginBottom: "20px" }}>
          Comption está pensado para que preguntar sea simple y responder sea claro.
        </p>
      </div>

      <div style={{ padding: "30px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px" }}>Guía rápida:</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {[
            "Ve a \"Hacer pregunta\" y describe tu problema con contexto.",
            "En el detalle de la pregunta puedes agregar respuestas.",
            "Si algo falla, vuelve a intentar y revisa los mensajes de error."
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
                borderLeft: "4px solid #007bff"
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}



