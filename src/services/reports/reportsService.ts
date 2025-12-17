import type { Report } from "../../domain/types";
import { ServiceError } from "../errors";
import { InMemoryReportsRepository } from "./InMemoryReportsRepository";
import type { CreateReportInput, ReportsRepository } from "./ReportsRepository";

class ReportsService {
  private repo: ReportsRepository;

  constructor(repo: ReportsRepository) {
    this.repo = repo;
  }

  create(input: CreateReportInput, reporterId: string) {
    if (!input.description.trim()) {
      throw new ServiceError("validation/invalid-argument", "La descripción del reporte es obligatoria");
    }
    return this.repo.create(input, reporterId);
  }

  listPending() {
    return this.repo.listPending();
  }

  listAll() {
    return this.repo.listAll();
  }

  getById(id: string) {
    return this.repo.getById(id);
  }

  updateStatus(id: string, status: Report["status"], reviewedBy: string) {
    return this.repo.updateStatus(id, status, reviewedBy);
  }

  reset() {
    return this.repo.reset();
  }
}

export const reportsService = new ReportsService(new InMemoryReportsRepository());

