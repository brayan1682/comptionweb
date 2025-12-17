import type { Report } from "../../domain/types";
import { ServiceError } from "../errors";
import { newId, nowIso } from "../utils";
import type { CreateReportInput, ReportsRepository } from "./ReportsRepository";

export class InMemoryReportsRepository implements ReportsRepository {
  private reports: Report[] = [];

  async create(input: CreateReportInput, reporterId: string): Promise<Report> {
    const report: Report = {
      id: newId(),
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      questionId: input.questionId || null,
      reason: input.reason,
      description: input.description.trim(),
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: nowIso()
    };
    this.reports.push(report);
    return report;
  }

  async listPending(): Promise<Report[]> {
    return this.reports.filter((r) => r.status === "pending").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listAll(): Promise<Report[]> {
    return [...this.reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getById(id: string): Promise<Report | null> {
    return this.reports.find((r) => r.id === id) ?? null;
  }

  async updateStatus(id: string, status: Report["status"], reviewedBy: string): Promise<Report> {
    const report = this.reports.find((r) => r.id === id);
    if (!report) throw new ServiceError("validation/invalid-argument", "Reporte no encontrado");
    report.status = status;
    report.reviewedBy = reviewedBy;
    report.reviewedAt = nowIso();
    return report;
  }

  reset() {
    this.reports = [];
  }
}

