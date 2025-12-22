import { Outlet } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export function PrivateLayout() {
  return (
    <div>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}



