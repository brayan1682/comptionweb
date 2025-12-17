import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function PublicOnlyRoute() {
  const { user, isReady } = useAuth();
  if (!isReady) return <p>Cargando...</p>;
  if (user) return <Navigate to="/home" replace />;
  return <Outlet />;
}



