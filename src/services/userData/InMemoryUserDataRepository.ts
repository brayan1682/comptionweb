import { nowIso } from "../utils";
import type { FollowedQuestion, SavedQuestion, UserDataRepository } from "./UserDataRepository";

export class InMemoryUserDataRepository implements UserDataRepository {
  private savedQuestions: Map<string, SavedQuestion> = new Map(); // key: userId-questionId
  private followedQuestions: Map<string, FollowedQuestion> = new Map(); // key: userId-questionId

  private getSavedKey(userId: string, questionId: string): string {
    return `${userId}-${questionId}`;
  }

  async saveQuestion(userId: string, questionId: string): Promise<SavedQuestion> {
    const key = this.getSavedKey(userId, questionId);
    const existing = this.savedQuestions.get(key);
    if (existing) return existing;

    const saved: SavedQuestion = {
      userId,
      questionId,
      savedAt: nowIso()
    };
    this.savedQuestions.set(key, saved);
    return saved;
  }

  async unsaveQuestion(userId: string, questionId: string): Promise<void> {
    const key = this.getSavedKey(userId, questionId);
    this.savedQuestions.delete(key);
  }

  async getSavedQuestions(userId: string): Promise<string[]> {
    const questionIds: string[] = [];
    for (const saved of this.savedQuestions.values()) {
      if (saved.userId === userId) {
        questionIds.push(saved.questionId);
      }
    }
    return questionIds;
  }

  async isQuestionSaved(userId: string, questionId: string): Promise<boolean> {
    const key = this.getSavedKey(userId, questionId);
    return this.savedQuestions.has(key);
  }

  async followQuestion(userId: string, questionId: string): Promise<FollowedQuestion> {
    const key = this.getSavedKey(userId, questionId);
    const existing = this.followedQuestions.get(key);
    if (existing) return existing;

    const followed: FollowedQuestion = {
      userId,
      questionId,
      followedAt: nowIso()
    };
    this.followedQuestions.set(key, followed);
    return followed;
  }

  async unfollowQuestion(userId: string, questionId: string): Promise<void> {
    const key = this.getSavedKey(userId, questionId);
    this.followedQuestions.delete(key);
  }

  async getFollowedQuestions(userId: string): Promise<string[]> {
    const questionIds: string[] = [];
    for (const followed of this.followedQuestions.values()) {
      if (followed.userId === userId) {
        questionIds.push(followed.questionId);
      }
    }
    return questionIds;
  }

  async getQuestionFollowers(questionId: string): Promise<string[]> {
    const userIds: string[] = [];
    for (const followed of this.followedQuestions.values()) {
      if (followed.questionId === questionId) {
        userIds.push(followed.userId);
      }
    }
    return userIds;
  }

  async isQuestionFollowed(userId: string, questionId: string): Promise<boolean> {
    const key = this.getSavedKey(userId, questionId);
    return this.followedQuestions.has(key);
  }

  reset() {
    this.savedQuestions.clear();
    this.followedQuestions.clear();
  }
}

