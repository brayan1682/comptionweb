import type { Report, ReportReason } from "../../domain/types";

export type CreateReportInput = {
  targetType: "question" | "answer";
  targetId: string;
  questionId?: string; // Para respuestas, necesitamos el questionId
  reason: ReportReason;
  description: string;
};

export interface ReportsRepository {
  create(input: CreateReportInput, reporterId: string): Promise<Report>;
  listPending(): Promise<Report[]>;
  listAll(): Promise<Report[]>;
  getById(id: string): Promise<Report | null>;
  updateStatus(id: string, status: Report["status"], reviewedBy: string): Promise<Report>;
  reset(): void;
}

