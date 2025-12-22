import type { UserReputation } from "../../domain/types";

export interface ReputationRepository {
  getByUserId(userId: string): Promise<UserReputation | null>;
  addXp(userId: string, xpAmount: number): Promise<UserReputation>;
  setTrophiesCount(userId: string, count: number): Promise<UserReputation>;
  reset(): void;
}

