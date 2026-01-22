export type PublicProfile = {
  uid: string;
  displayName: string;
  photoURL?: string;
  level: number;
  rank: string;
  xp: number;
  questionsCount: number;
  answersCount: number;
  avgRating: number;
  createdAt: string;
  updatedAt: string;
};

export interface PublicProfilesRepository {
  getByUserId(userId: string): Promise<PublicProfile | null>;
  syncFromUser(userId: string, userData: {
    displayName: string;
    photoURL?: string;
    level: number;
    rank: string;
    xp: number;
    questionsCount: number;
    answersCount: number;
    avgRating: number;
  }): Promise<void>;
}







