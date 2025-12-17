import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function ProtectedRoute() {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return <p>Cargando...</p>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <Outlet />;
}



