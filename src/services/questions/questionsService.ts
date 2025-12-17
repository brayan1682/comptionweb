import type { User } from "../../domain/types";
import { ServiceError } from "../errors";
import { InMemoryQuestionsRepository } from "./InMemoryQuestionsRepository";
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

  deleteQuestion(questionId: string, adminUser: User | null) {
    if (!adminUser) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.deleteQuestion(questionId, adminUser);
  }

  deleteAnswer(questionId: string, answerId: string, adminUser: User | null) {
    if (!adminUser) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
    return this.repo.deleteAnswer(questionId, answerId, adminUser);
  }

  reset() {
    return this.repo.reset();
  }
}

export const questionsService = new QuestionsService(new InMemoryQuestionsRepository());


