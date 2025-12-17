import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div>
      <h1>404</h1>
      <p>Esta página no existe.</p>
      <p>
        <Link to="/">Ir al inicio</Link>
      </p>
    </div>
  );
}



