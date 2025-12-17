import type { Answer, Question, User } from "../../domain/types";

export type CreateQuestionInput = {
  title: string;
  description: string;
  isAnonymous: boolean;
  category: string;
  tags: string[]; // 1-5 tags predefinidos
};

export type AddAnswerInput = {
  questionId: string;
  content: string;
  isAnonymous: boolean;
};

export interface QuestionsRepository {
  listQuestions(): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | null>;
  createQuestion(input: CreateQuestionInput, author: User): Promise<Question>;
  addAnswer(input: AddAnswerInput, author: User): Promise<Answer>;
  registerUniqueView(questionId: string, viewer: User): Promise<Question>;
  updateQuestion(input: { id: string; title: string; description: string; isAnonymous: boolean }, author: User): Promise<Question>;
  updateAnswer(input: { questionId: string; answerId: string; content: string }, author: User): Promise<Answer>;
  rateAnswer(input: { questionId: string; answerId: string; value: number }, rater: User): Promise<Answer>;
  rateQuestion(input: { questionId: string; value: number }, rater: User): Promise<Question>;
  listQuestionsByAuthorId(authorId: string): Promise<Question[]>;
  listAnswersByAuthorId(authorId: string): Promise<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>>;
  syncAuthorName(authorId: string, newName: string): Promise<void>;
  deleteQuestion(questionId: string, adminUser: User): Promise<void>;
  deleteAnswer(questionId: string, answerId: string, adminUser: User): Promise<void>;
  reset(): void;
}


