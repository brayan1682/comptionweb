import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { ServiceError } from "../services/errors";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ name, email, password });
      navigate("/welcome", { replace: true });
    } catch (err) {
      if (err instanceof ServiceError) setError(err.message);
      else setError("No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Registro</h1>
      <form onSubmit={onSubmit}>
        <div>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        </div>
        <div>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          </label>
        </div>
        <div>
          <label>
            Contraseña
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="********"
            />
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}


