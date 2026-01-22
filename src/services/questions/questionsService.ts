import type { User } from "../../domain/types";
import { ServiceError } from "../errors";
import { FirestoreQuestionsRepository } from "./FirestoreQuestionsRepository";
import type { AddAnswerInput, CreateQuestionInput, QuestionsRepository } from "./QuestionsRepository";

class QuestionsService {
  private repo: QuestionsRepository;

  constructor(repo: QuestionsRepository) {
    this.repo = repo;
  }

  listQuestions() {
    return this.repo.listQuestions();
  }

  getQuestionById(id: string) {
    return this.repo.getQuestionById(id);
  }

  createQuestion(input: CreateQuestionInput, author: User | null) {
    if (!author) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para preguntar");
    return this.repo.createQuestion(input, author);
  }

  addAnswer(input: AddAnswerInput, author: User | null) {
    if (!author) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para responder");
    return this.repo.addAnswer(input, author);
  }

  registerUniqueView(questionId: string, viewer: User | null) {
    if (!viewer) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.registerUniqueView(questionId, viewer);
  }

  updateQuestion(
    input: { id: string; title: string; description: string; isAnonymous: boolean; category: string; tags: string[] },
    author: User | null
  ) {
    if (!author) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.updateQuestion(input, author);
  }

  updateAnswer(input: { questionId: string; answerId: string; content: string }, author: User | null) {
    if (!author) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.updateAnswer(input, author);
  }

  rateAnswer(input: { questionId: string; answerId: string; value: number }, rater: User | null) {
    if (!rater) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.rateAnswer(input, rater);
  }

  rateQuestion(input: { questionId: string; value: number }, rater: User | null) {
    if (!rater) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.rateQuestion(input, rater);
  }

  listQuestionsByAuthorId(authorId: string, user: User | null) {
    if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    if (user.id !== authorId) throw new ServiceError("validation/invalid-argument", "No autorizado");
    return this.repo.listQuestionsByAuthorId(authorId);
  }

  listAnswersByAuthorId(authorId: string, user: User | null) {
    if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    if (user.id !== authorId) throw new ServiceError("validation/invalid-argument", "No autorizado");
    return this.repo.listAnswersByAuthorId(authorId);
  }

  syncAuthorName(authorId: string, newName: string) {
    return this.repo.syncAuthorName(authorId, newName);
  }

  syncQuestionsCount(userId: string) {
    return this.repo.syncQuestionsCount(userId);
  }

  syncAnswersCount(userId: string) {
    return this.repo.syncAnswersCount(userId);
  }

  recalculateStats(userId: string) {
    return this.repo.recalculateStats(userId);
  }

  // ✅ DOMAIN FUNCTION: Delete question with all side effects
  deleteQuestionWithSideEffects(questionId: string, adminUser: User | null) {
    if (!adminUser) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.deleteQuestionWithSideEffects(questionId, adminUser);
  }

  // ✅ DOMAIN FUNCTION: Delete answer with all side effects
  deleteAnswerWithSideEffects(questionId: string, answerId: string, adminUser: User | null) {
    if (!adminUser) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.deleteAnswerWithSideEffects(questionId, answerId, adminUser);
  }

  // Legacy aliases for backward compatibility (deprecated - use WithSideEffects versions)
  deleteQuestion(questionId: string, adminUser: User | null) {
    return this.deleteQuestionWithSideEffects(questionId, adminUser);
  }

  deleteAnswer(questionId: string, answerId: string, adminUser: User | null) {
    return this.deleteAnswerWithSideEffects(questionId, answerId, adminUser);
  }

  addReply(input: { questionId: string; answerId: string; content: string }, author: User | null) {
    if (!author) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.addReply(input, author);
  }

  listReplies(questionId: string, answerId: string) {
    return this.repo.listReplies(questionId, answerId);
  }

  deleteReply(questionId: string, answerId: string, replyId: string, adminUser: User | null) {
    if (!adminUser) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.deleteReply(questionId, answerId, replyId, adminUser);
  }

  reset() {
    return this.repo.reset();
  }
}

export const questionsService = new QuestionsService(new FirestoreQuestionsRepository());


