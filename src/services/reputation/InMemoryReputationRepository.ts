import type { UserReputation } from "../../domain/types";
import { nowIso } from "../utils";
import { calculateLevel, calculateRank } from "./reputationUtils";
import type { ReputationRepository } from "./ReputationRepository";

export class InMemoryReputationRepository implements ReputationRepository {
  private reputations: Map<string, UserReputation> = new Map();

  async getByUserId(userId: string): Promise<UserReputation | null> {
    return this.reputations.get(userId) ?? null;
  }

  async addXp(userId: string, xpAmount: number): Promise<UserReputation> {
    const existing = await this.getByUserId(userId);
    const now = nowIso();

    if (!existing) {
      // Crear nueva reputación
      const xp = xpAmount;
      const level = calculateLevel(xp);
      const rank = calculateRank(level);
      const rep: UserReputation = {
        userId,
        xp,
        level,
        rank,
        trophiesCount: 0,
        createdAt: now,
        updatedAt: now
      };
      this.reputations.set(userId, rep);
      return rep;
    }

    // Actualizar XP existente
    const newXp = existing.xp + xpAmount;
    const newLevel = calculateLevel(newXp);
    const newRank = calculateRank(newLevel);

    const updated: UserReputation = {
      ...existing,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updatedAt: now
    };
    this.reputations.set(userId, updated);
    return updated;
  }

  async setTrophiesCount(userId: string, count: number): Promise<UserReputation> {
    const existing = await this.getByUserId(userId);
    const now = nowIso();

    if (!existing) {
      // Si no existe, crear con 0 XP
      const rep: UserReputation = {
        userId,
        xp: 0,
        level: 1,
        rank: calculateRank(1),
        trophiesCount: count,
        createdAt: now,
        updatedAt: now
      };
      this.reputations.set(userId, rep);
      return rep;
    }

    const updated: UserReputation = {
      ...existing,
      trophiesCount: count,
      updatedAt: now
    };
    this.reputations.set(userId, updated);
    return updated;
  }

  reset() {
    this.reputations.clear();
  }
}

