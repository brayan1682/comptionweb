import React, { createContext, useContext, useMemo } from "react";
import type { Report } from "../../domain/types";
import { reportsService } from "../../services/reports/reportsService";
import type { CreateReportInput } from "../../services/reports/ReportsRepository";
import { useAuth } from "./AuthProvider";

type ReportsContextValue = {
  createReport: (input: CreateReportInput) => Promise<Report>;
  listPending: () => Promise<Report[]>;
  listAll: () => Promise<Report[]>;
  updateStatus: (id: string, status: Report["status"]) => Promise<Report>;
};

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const value = useMemo<ReportsContextValue>(
    () => ({
      createReport: async (input: CreateReportInput) => {
        if (!user) throw new Error("No autenticado");
        return reportsService.create(input, user.id);
      },
      listPending: async () => {
        if (!user || user.role !== "ADMIN") throw new Error("Solo administradores");
        return reportsService.listPending();
      },
      listAll: async () => {
        if (!user || user.role !== "ADMIN") throw new Error("Solo administradores");
        return reportsService.listAll();
      },
      updateStatus: async (id: string, status: Report["status"]) => {
        if (!user || user.role !== "ADMIN") throw new Error("Solo administradores");
        return reportsService.updateStatus(id, status, user.id);
      }
    }),
    [user]
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error("useReports debe usarse dentro de <ReportsProvider />");
  return ctx;
}

