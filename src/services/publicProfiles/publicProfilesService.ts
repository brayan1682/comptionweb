import type { PublicProfilesRepository, PublicProfile } from "./PublicProfilesRepository";
import { FirestorePublicProfilesRepository } from "./FirestorePublicProfilesRepository";

class PublicProfilesService {
  private repo: PublicProfilesRepository;

  constructor(repo: PublicProfilesRepository) {
    this.repo = repo;
  }

  getByUserId(userId: string): Promise<PublicProfile | null> {
    return this.repo.getByUserId(userId);
  }

  syncFromUser(
    userId: string,
    userData: {
      displayName: string;
      photoURL?: string;
      level: number;
      rank: string;
      xp: number;
      questionsCount: number;
      answersCount: number;
      avgRating: number;
    }
  ): Promise<void> {
    return this.repo.syncFromUser(userId, userData);
  }
}

export const publicProfilesService = new PublicProfilesService(new FirestorePublicProfilesRepository());







