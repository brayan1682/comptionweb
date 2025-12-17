import { InMemoryUserDataRepository } from "./InMemoryUserDataRepository";
import type { UserDataRepository } from "./UserDataRepository";

class UserDataService {
  private repo: UserDataRepository;

  constructor(repo: UserDataRepository) {
    this.repo = repo;
  }

  saveQuestion(userId: string, questionId: string) {
    return this.repo.saveQuestion(userId, questionId);
  }

  unsaveQuestion(userId: string, questionId: string) {
    return this.repo.unsaveQuestion(userId, questionId);
  }

  getSavedQuestions(userId: string) {
    return this.repo.getSavedQuestions(userId);
  }

  isQuestionSaved(userId: string, questionId: string) {
    return this.repo.isQuestionSaved(userId, questionId);
  }

  followQuestion(userId: string, questionId: string) {
    return this.repo.followQuestion(userId, questionId);
  }

  unfollowQuestion(userId: string, questionId: string) {
    return this.repo.unfollowQuestion(userId, questionId);
  }

  getFollowedQuestions(userId: string) {
    return this.repo.getFollowedQuestions(userId);
  }

  getQuestionFollowers(questionId: string) {
    return this.repo.getQuestionFollowers(questionId);
  }

  isQuestionFollowed(userId: string, questionId: string) {
    return this.repo.isQuestionFollowed(userId, questionId);
  }

  reset() {
    return this.repo.reset();
  }
}

export const userDataService = new UserDataService(new InMemoryUserDataRepository());

