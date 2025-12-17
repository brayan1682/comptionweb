import { Link } from "react-router-dom";

export function WelcomePage() {
  return (
    <div>
      <h1>¡Bienvenido a Comption! 🎯</h1>
      <p>
        <strong>Bienvenido al entorno tecnológico donde las preguntas son la presa, las respuestas el arma, y el cazador es nuestra
          comunidad.</strong>
      </p>
      <p>Estás listo para comenzar tu viaje en la plataforma. Aquí podrás:</p>
      <ul>
        <li>Hacer preguntas sobre tecnología y recibir respuestas de la comunidad</li>
        <li>Responder preguntas y ganar reputación</li>
        <li>Calificar contenido y construir tu perfil</li>
        <li>Subir de nivel y alcanzar nuevos rangos</li>
        <li>Obtener trofeos por tus mejores aportes</li>
      </ul>
      <p>
        <Link to="/home">Comenzar a explorar →</Link>
      </p>
    </div>
  );
}

