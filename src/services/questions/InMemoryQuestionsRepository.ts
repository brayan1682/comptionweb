import type { Answer, Question, User } from "../../domain/types";
import { ServiceError } from "../errors";
import { newId, nowIso } from "../utils";
import type { AddAnswerInput, CreateQuestionInput, QuestionsRepository } from "./QuestionsRepository";
import { notificationsService } from "../notifications/notificationsService";
import { answerRatedNotification, newAnswerNotification } from "../notifications/factories";
import { reputationService } from "../reputation/reputationService";
import { XP_VALUES } from "../reputation/reputationUtils";
import { CATEGORIES, PREDEFINED_TAGS } from "../categories/categoriesData";
import { userDataService } from "../userData/userDataService";

// Constantes para el sistema de trofeos
const MIN_VOTES_FOR_TROPHY = 3; // Mínimo de votos para ser elegible para trofeo

export class InMemoryQuestionsRepository implements QuestionsRepository {
  private questions: Question[] = [];

  // Calcular y asignar trofeo a la mejor respuesta de una pregunta
  private async updateTrophyForQuestion(question: Question): Promise<void> {
    if (question.answers.length === 0) {
      question.trophyAnswerId = null;
      return;
    }

    // Filtrar respuestas con suficiente número de votos
    const eligibleAnswers = question.answers.filter((a) => a.ratingCount >= MIN_VOTES_FOR_TROPHY);

    if (eligibleAnswers.length === 0) {
      question.trophyAnswerId = null;
      return;
    }

    // Encontrar la respuesta con mejor promedio (desempate: más votos, luego más reciente)
    const bestAnswer = eligibleAnswers.reduce((best, current) => {
      if (current.ratingAvg > best.ratingAvg) return current;
      if (current.ratingAvg < best.ratingAvg) return best;
      // Mismo promedio: desempate por más votos
      if (current.ratingCount > best.ratingCount) return current;
      if (current.ratingCount < best.ratingCount) return best;
      // Mismo promedio y votos: más reciente
      return current.createdAt > best.createdAt ? current : best;
    });

    const previousTrophyId = question.trophyAnswerId;
    question.trophyAnswerId = bestAnswer.id;

    // Si el trofeo cambió, asignar XP al nuevo ganador
    if (previousTrophyId !== bestAnswer.id) {
      await reputationService.addXp(bestAnswer.authorId, XP_VALUES.TROPHY_OBTAINED);
      // Actualizar contador de trofeos del usuario
      const rep = await reputationService.getByUserId(bestAnswer.authorId);
      if (rep) {
        await reputationService.setTrophiesCount(bestAnswer.authorId, rep.trophiesCount + 1);
      } else {
        await reputationService.setTrophiesCount(bestAnswer.authorId, 1);
      }
    }
  }

  async listQuestions(): Promise<Question[]> {
    // orden más nuevo primero (como un query de Firestore por createdAt desc)
    return [...this.questions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getQuestionById(id: string): Promise<Question | null> {
    return this.questions.find((q) => q.id === id) ?? null;
  }

  async createQuestion(input: CreateQuestionInput, author: User): Promise<Question> {
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 8) throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    if (description.length < 10) throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");

    // Validar categoría
    if (!CATEGORIES.includes(input.category as any)) {
      throw new ServiceError("validation/invalid-argument", "Categoría inválida");
    }

    // Validar tags (1-5 tags, todos predefinidos)
    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5) {
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    }
    const invalidTags = tags.filter((tag) => !PREDEFINED_TAGS.includes(tag as any));
    if (invalidTags.length > 0) {
      throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);
    }

    const now = nowIso();
    const q: Question = {
      id: newId(),
      title,
      description,
      authorId: author.id,
      authorName: author.name,
      isAnonymous: Boolean(input.isAnonymous),
      category: input.category,
      tags: [...tags], // Copia del array
      createdAt: now,
      updatedAt: now,
      answers: [],
      viewedByUserId: {},
      viewsCount: 0,
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0,
      trophyAnswerId: null
    };
    this.questions.push(q);
    return q;
  }

  async addAnswer(input: AddAnswerInput, author: User): Promise<Answer> {
    const content = input.content.trim();
    if (content.length < 2) throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");

    const q = this.questions.find((x) => x.id === input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const now = nowIso();
    const a: Answer = {
      id: newId(),
      questionId: q.id,
      content,
      authorId: author.id,
      authorName: author.name,
      isAnonymous: Boolean(input.isAnonymous),
      createdAt: now,
      updatedAt: now,
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0
    };

    q.answers = [...q.answers, a];

    // Asignar XP por publicar respuesta (XP bajo)
    await reputationService.addXp(author.id, XP_VALUES.ANSWER_PUBLISHED);

    // Notificar al autor de la pregunta (si no es el mismo que responde)
    if (q.authorId !== author.id) {
      await notificationsService.create(
        newAnswerNotification({ userId: q.authorId, questionId: q.id, answerId: a.id, fromUserId: author.id })
      );
    }

    // Notificar a todos los usuarios que siguen esta pregunta
    const followedBy = await userDataService.getQuestionFollowers(q.id);
    for (const followerId of followedBy) {
      if (followerId !== q.authorId && followerId !== author.id) {
        await notificationsService.create(
          newAnswerNotification({ userId: followerId, questionId: q.id, answerId: a.id, fromUserId: author.id })
        );
      }
    }

    // Recalcular trofeo después de agregar respuesta (aunque probablemente no haya suficientes votos aún)
    await this.updateTrophyForQuestion(q);

    return a;
  }

  async registerUniqueView(questionId: string, viewer: User): Promise<Question> {
    const q = this.questions.find((x) => x.id === questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    if (q.viewedByUserId[viewer.id]) return q;
    q.viewedByUserId = { ...q.viewedByUserId, [viewer.id]: true };
    q.viewsCount = Object.keys(q.viewedByUserId).length;
    return q;
  }

  async updateQuestion(
    input: { id: string; title: string; description: string; isAnonymous: boolean; category: string; tags: string[] },
    author: User
  ): Promise<Question> {
    const q = this.questions.find((x) => x.id === input.id);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    if (q.authorId !== author.id) throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la pregunta");
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 8) throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    if (description.length < 10) throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");

    // Validar categoría
    if (!CATEGORIES.includes(input.category as any)) {
      throw new ServiceError("validation/invalid-argument", "Categoría inválida");
    }

    // Validar tags (1-5 tags, todos predefinidos)
    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5) {
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    }
    const invalidTags = tags.filter((tag) => !PREDEFINED_TAGS.includes(tag as any));
    if (invalidTags.length > 0) {
      throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);
    }

    q.title = title;
    q.description = description;
    q.isAnonymous = Boolean(input.isAnonymous);
    q.category = input.category;
    q.tags = [...tags];
    q.updatedAt = nowIso();
    return q;
  }

  async updateAnswer(input: { questionId: string; answerId: string; content: string }, author: User): Promise<Answer> {
    const q = this.questions.find((x) => x.id === input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    const a = q.answers.find((x) => x.id === input.answerId);
    if (!a) throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    if (a.authorId !== author.id) throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la respuesta");
    const content = input.content.trim();
    if (content.length < 2) throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");
    a.content = content;
    a.updatedAt = nowIso();
    return a;
  }

  async rateAnswer(input: { questionId: string; answerId: string; value: number }, rater: User): Promise<Answer> {
    const q = this.questions.find((x) => x.id === input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    const a = q.answers.find((x) => x.id === input.answerId);
    if (!a) throw new ServiceError("questions/not-found", "Respuesta no encontrada");

    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");
    }
    if (a.ratingsByUserId[rater.id] != null) {
      throw new ServiceError("validation/invalid-argument", "Solo puedes calificar una vez esta respuesta");
    }
    a.ratingsByUserId = { ...a.ratingsByUserId, [rater.id]: value };

    const all = Object.values(a.ratingsByUserId);
    a.ratingCount = all.length;
    a.ratingAvg = all.length ? Math.round((all.reduce((s, v) => s + v, 0) / all.length) * 10) / 10 : 0;
    a.updatedAt = nowIso();

    // Asignar XP si la respuesta recibe un rating >= 4 (XP medio)
    if (value >= 4 && a.authorId !== rater.id) {
      await reputationService.addXp(a.authorId, XP_VALUES.ANSWER_WELL_RATED);
    }

    // Notificar al autor de la respuesta cuando otro usuario califica
    if (a.authorId !== rater.id) {
      await notificationsService.create(
        answerRatedNotification({
          userId: a.authorId,
          questionId: q.id,
          answerId: a.id,
          fromUserId: rater.id,
          rating: value,
          ratingAvg: a.ratingAvg
        })
      );
    }

    // Recalcular trofeo después de calificar
    await this.updateTrophyForQuestion(q);

    return a;
  }

  async rateQuestion(input: { questionId: string; value: number }, rater: User): Promise<Question> {
    const q = this.questions.find((x) => x.id === input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");
    }
    if (q.ratingsByUserId[rater.id] != null) {
      throw new ServiceError("validation/invalid-argument", "Solo puedes calificar una vez esta pregunta");
    }
    q.ratingsByUserId = { ...q.ratingsByUserId, [rater.id]: value };

    const all = Object.values(q.ratingsByUserId);
    q.ratingCount = all.length;
    q.ratingAvg = all.length ? Math.round((all.reduce((s, v) => s + v, 0) / all.length) * 10) / 10 : 0;
    q.updatedAt = nowIso();

    // Asignar XP si la pregunta recibe un rating >= 4 (XP medio)
    if (value >= 4 && q.authorId !== rater.id) {
      await reputationService.addXp(q.authorId, XP_VALUES.QUESTION_WELL_RATED);
    }

    return q;
  }

  async listQuestionsByAuthorId(authorId: string): Promise<Question[]> {
    return (await this.listQuestions()).filter((q) => q.authorId === authorId);
  }

  async listAnswersByAuthorId(authorId: string): Promise<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>> {
    const items: Array<{ questionId: string; answerId: string; content: string; createdAt: string }> = [];
    for (const q of this.questions) {
      for (const a of q.answers) {
        if (a.authorId === authorId) items.push({ questionId: q.id, answerId: a.id, content: a.content, createdAt: a.createdAt });
      }
    }
    // más nuevas primero
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async syncQuestionsCount(userId: string): Promise<number> {
    // En memoria, contar las preguntas del usuario
    const count = this.questions.filter((q) => q.authorId === userId).length;
    return count;
  }

  async syncAnswersCount(_userId: string): Promise<number> {
    throw new Error("Not implemented");
  }

  async recalculateStats(_userId: string): Promise<{ questionsCount: number; answersCount: number }> {
    throw new Error("Not implemented");
  }

  async addReply(_input: { questionId: string; answerId: string; content: string }, _author: User): Promise<import("../../domain/reply").Reply> {
    throw new Error("Not implemented");
  }

  async listReplies(_questionId: string, _answerId: string): Promise<import("../../domain/reply").Reply[]> {
    throw new Error("Not implemented");
  }

  async deleteReply(_questionId: string, _answerId: string, _replyId: string, _adminUser: User): Promise<void> {
    throw new Error("Not implemented");
  }

  async syncAuthorName(authorId: string, newName: string): Promise<void> {
    for (const q of this.questions) {
      if (q.authorId === authorId) q.authorName = newName;
      for (const a of q.answers) {
        if (a.authorId === authorId) a.authorName = newName;
      }
    }
  }

  // ✅ DOMAIN FUNCTION: Delete question with all side effects
  async deleteQuestionWithSideEffects(questionId: string, adminUser: User): Promise<void> {
    if (adminUser.role !== "ADMIN") {
      throw new ServiceError("validation/invalid-argument", "Solo administradores pueden eliminar preguntas");
    }
    const index = this.questions.findIndex((q) => q.id === questionId);
    if (index === -1) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    this.questions.splice(index, 1);
  }

  // ✅ DOMAIN FUNCTION: Delete answer with all side effects
  async deleteAnswerWithSideEffects(questionId: string, answerId: string, adminUser: User): Promise<void> {
    if (adminUser.role !== "ADMIN") {
      throw new ServiceError("validation/invalid-argument", "Solo administradores pueden eliminar respuestas");
    }
    const q = this.questions.find((x) => x.id === questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    const index = q.answers.findIndex((a) => a.id === answerId);
    if (index === -1) throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    q.answers.splice(index, 1);
  }

  // Legacy aliases for backward compatibility
  async deleteQuestion(questionId: string, adminUser: User): Promise<void> {
    return this.deleteQuestionWithSideEffects(questionId, adminUser);
  }

  async deleteAnswer(questionId: string, answerId: string, adminUser: User): Promise<void> {
    return this.deleteAnswerWithSideEffects(questionId, answerId, adminUser);
  }

  reset() {
    this.questions = [];
  }
}


