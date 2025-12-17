import type { UserReputation } from "../../domain/types";
import { InMemoryReputationRepository } from "./InMemoryReputationRepository";
import type { ReputationRepository } from "./ReputationRepository";

class ReputationService {
  private repo: ReputationRepository;

  constructor(repo: ReputationRepository) {
    this.repo = repo;
  }

  getByUserId(userId: string) {
    return this.repo.getByUserId(userId);
  }

  addXp(userId: string, xpAmount: number) {
    return this.repo.addXp(userId, xpAmount);
  }

  setTrophiesCount(userId: string, count: number) {
    return this.repo.setTrophiesCount(userId, count);
  }

  reset() {
    return this.repo.reset();
  }
}

export const reputationService = new ReputationService(new InMemoryReputationRepository());

