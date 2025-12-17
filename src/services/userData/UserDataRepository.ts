// Datos del usuario: preguntas guardadas y seguidas
export type SavedQuestion = {
  userId: string;
  questionId: string;
  savedAt: string; // ISO
};

export type FollowedQuestion = {
  userId: string;
  questionId: string;
  followedAt: string; // ISO
};

export interface UserDataRepository {
  saveQuestion(userId: string, questionId: string): Promise<SavedQuestion>;
  unsaveQuestion(userId: string, questionId: string): Promise<void>;
  getSavedQuestions(userId: string): Promise<string[]>; // Retorna array de questionIds
  isQuestionSaved(userId: string, questionId: string): Promise<boolean>;

  followQuestion(userId: string, questionId: string): Promise<FollowedQuestion>;
  unfollowQuestion(userId: string, questionId: string): Promise<void>;
  getFollowedQuestions(userId: string): Promise<string[]>; // Retorna array de questionIds que el usuario sigue
  getQuestionFollowers(questionId: string): Promise<string[]>; // Retorna array de userIds que siguen esta pregunta
  isQuestionFollowed(userId: string, questionId: string): Promise<boolean>;

  reset(): void;
}

