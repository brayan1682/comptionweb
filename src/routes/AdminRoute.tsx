import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

export function AdminRoute() {
  const { user, isReady } = useAuth();

  if (!isReady) return <p>Cargando...</p>;
  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
}

