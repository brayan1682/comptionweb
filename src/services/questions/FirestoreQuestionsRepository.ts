import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment
} from "firebase/firestore";
import type { Answer, Question, User } from "../../domain/types";
import { ServiceError } from "../errors";
import { nowIso } from "../utils";
import type { AddAnswerInput, CreateQuestionInput, QuestionsRepository } from "./QuestionsRepository";
import { notificationsService } from "../notifications/notificationsService";
import { answerRatedNotification, newAnswerNotification } from "../notifications/factories";
import { reputationService } from "../reputation/reputationService";
import { XP_VALUES } from "../reputation/reputationUtils";
import { CATEGORIES, PREDEFINED_TAGS } from "../categories/categoriesData";
import { userDataService } from "../userData/userDataService";
import { db } from "../../firebase/firebase";

// Constantes para el sistema de trofeos
const MIN_VOTES_FOR_TROPHY = 3;

export class FirestoreQuestionsRepository implements QuestionsRepository {
  // Convertir Firestore Timestamp a ISO string
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (typeof timestamp === "string") {
      return timestamp;
    }
    return new Date().toISOString();
  }

  // Convertir ISO string a Firestore Timestamp
  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  // Convertir documento de pregunta de Firestore a Question
  private async firestoreQuestionToQuestion(questionDoc: any): Promise<Question> {
    const data = questionDoc.data();
    const questionId = questionDoc.id;

    // Obtener respuestas de la subcolección
    const answersSnapshot = await getDocs(collection(db, "questions", questionId, "answers"));
    const answers: Answer[] = [];

    for (const answerDoc of answersSnapshot.docs) {
      const answerData = answerDoc.data();
      answers.push({
        id: answerDoc.id,
        questionId,
        content: answerData.content,
        authorId: answerData.authorId,
        authorName: answerData.authorName,
        isAnonymous: answerData.isAnonymous || false,
        createdAt: this.timestampToIso(answerData.createdAt),
        updatedAt: this.timestampToIso(answerData.updatedAt),
        ratingsByUserId: answerData.ratingsByUserId || {},
        ratingAvg: answerData.ratingAvg || 0,
        ratingCount: answerData.ratingCount || 0,
      });
    }

    // Ordenar respuestas por fecha (más nuevas primero)
    answers.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    // Asegurar que todos los campos obligatorios existan (compatibilidad con preguntas antiguas)
    const now = nowIso();
    return {
      id: questionId,
      title: data.title || "Sin título",
      description: data.description || "",
      authorId: data.authorId || "",
      authorName: data.authorName || "Usuario desconocido",
      isAnonymous: data.isAnonymous || false,
      category: data.category || "General",
      tags: data.tags || [],
      createdAt: data.createdAt ? this.timestampToIso(data.createdAt) : now,
      updatedAt: data.updatedAt ? this.timestampToIso(data.updatedAt) : now,
      answers,
      viewedByUserId: data.viewedByUserId || {},
      viewsCount: data.viewsCount || 0,
      ratingsByUserId: data.ratingsByUserId || {},
      ratingAvg: data.ratingAvg || 0,
      ratingCount: data.ratingCount || 0,
      trophyAnswerId: data.trophyAnswerId || null,
    };
  }

  // Calcular y asignar trofeo a la mejor respuesta de una pregunta
  private async updateTrophyForQuestion(question: Question): Promise<void> {
    if (question.answers.length === 0) {
      await updateDoc(doc(db, "questions", question.id), {
        trophyAnswerId: null,
      });
      return;
    }

    const eligibleAnswers = question.answers.filter((a) => a.ratingCount >= MIN_VOTES_FOR_TROPHY);

    if (eligibleAnswers.length === 0) {
      await updateDoc(doc(db, "questions", question.id), {
        trophyAnswerId: null,
      });
      return;
    }

    const bestAnswer = eligibleAnswers.reduce((best, current) => {
      if (current.ratingAvg > best.ratingAvg) return current;
      if (current.ratingAvg < best.ratingAvg) return best;
      if (current.ratingCount > best.ratingCount) return current;
      if (current.ratingCount < best.ratingCount) return best;
      return current.createdAt > best.createdAt ? current : best;
    });

    const questionRef = doc(db, "questions", question.id);
    const questionDoc = await getDoc(questionRef);
    const previousTrophyId = questionDoc.data()?.trophyAnswerId || null;

    await updateDoc(questionRef, {
      trophyAnswerId: bestAnswer.id,
    });

    if (previousTrophyId !== bestAnswer.id) {
      await reputationService.addXp(bestAnswer.authorId, XP_VALUES.TROPHY_OBTAINED);
      const rep = await reputationService.getByUserId(bestAnswer.authorId);
      if (rep) {
        await reputationService.setTrophiesCount(bestAnswer.authorId, rep.trophiesCount + 1);
      } else {
        await reputationService.setTrophiesCount(bestAnswer.authorId, 1);
      }
    }
  }

  async listQuestions(): Promise<Question[]> {
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    const questions: Question[] = [];
    for (const questionDoc of snapshot.docs) {
      const question = await this.firestoreQuestionToQuestion(questionDoc);
      questions.push(question);
    }
    
    return questions;
  }

  async getQuestionById(id: string): Promise<Question | null> {
    // Normalizar el id: eliminar espacios y asegurar que sea string
    const normalizedId = id ? String(id).trim() : "";
    
    if (!normalizedId) {
      console.warn("[FirestoreQuestionsRepository] getQuestionById: ID vacío o inválido");
      return null;
    }

    console.log("[FirestoreQuestionsRepository] getQuestionById: Buscando pregunta con ID:", normalizedId, "(tipo:", typeof normalizedId, ", longitud:", normalizedId.length, ")");

    // Usar estrictamente doc(db, "questions", questionId) - NO usar where ni otras consultas
    const questionRef = doc(db, "questions", normalizedId);
    let questionDoc = await getDoc(questionRef);
    
    // Si no existe, esperar un poco y reintentar (para casos de propagación de Firestore)
    // Esto es especialmente importante justo después de crear una pregunta
    if (!questionDoc.exists()) {
      // Reintentar hasta 5 veces con esperas progresivas
      let attempts = 0;
      const maxAttempts = 5;
      while (!questionDoc.exists() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200 * (attempts + 1))); // Esperas progresivas: 200ms, 400ms, 600ms, 800ms, 1000ms
        questionDoc = await getDoc(questionRef);
        attempts++;
      }
    }

    // Solo retornar null si Firestore respondió y el documento realmente no existe
    if (!questionDoc.exists()) {
      console.warn(`[FirestoreQuestionsRepository] getQuestionById: Pregunta con ID "${normalizedId}" no encontrada en Firestore (doc.exists() === false) después de ${attempts} intentos`);
      return null;
    }
    
    const question = await this.firestoreQuestionToQuestion(questionDoc);
    console.log("[FirestoreQuestionsRepository] getQuestionById: Pregunta encontrada con ID:", question.id, "(tipo:", typeof question.id, ", longitud:", question.id.length, ")");
    return question;
  }

  async createQuestion(input: CreateQuestionInput, author: User): Promise<Question> {
    const title = input.title.trim();
    const description = input.description.trim();
    
    if (title.length < 8) {
      throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    }
    if (description.length < 10) {
      throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");
    }

    if (!CATEGORIES.includes(input.category as any)) {
      throw new ServiceError("validation/invalid-argument", "Categoría inválida");
    }

    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5) {
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    }
    const invalidTags = tags.filter((tag) => !PREDEFINED_TAGS.includes(tag as any));
    if (invalidTags.length > 0) {
      throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);
    }

    const now = nowIso();
    const questionRef = doc(collection(db, "questions"));
    const questionData = {
      title,
      description,
      authorId: author.id,
      authorName: author.name,
      isAnonymous: Boolean(input.isAnonymous),
      category: input.category,
      tags: [...tags],
      createdAt: this.isoToTimestamp(now),
      updatedAt: this.isoToTimestamp(now),
      viewedByUserId: {},
      viewsCount: 0,
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0,
      answersCount: 0,
      trophyAnswerId: null,
      status: "active" as const,
    };

    try {
      await setDoc(questionRef, questionData);
    } catch (error: any) {
      console.error("Error al crear pregunta en Firestore:", error);
      throw new ServiceError(
        "questions/create-failed",
        error?.message || "No se pudo crear la pregunta. Por favor, intenta nuevamente."
      );
    }

    // Actualizar contador de preguntas del usuario y dar XP
    try {
      const userRef = doc(db, "users", author.id);
      const userDoc = await getDoc(userRef);
      
      // Asegurar que questionsCount exista (inicializar si no existe)
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentCount = userData.questionsCount ?? 0;
        await updateDoc(userRef, {
          questionsCount: currentCount + 1,
        });
      } else {
        // Si el documento no existe, crearlo con questionsCount = 1
        await setDoc(userRef, {
          questionsCount: 1,
          level: 1,
          xp: 0,
          rank: "Novato",
          answersCount: 0,
          avgRating: 0,
        }, { merge: true });
      }
      
      // Dar XP por crear pregunta
      await reputationService.addXp(author.id, XP_VALUES.QUESTION_PUBLISHED);
    } catch (error: any) {
      console.error("Error actualizando contador de preguntas del usuario:", error);
      // No lanzamos error aquí porque la pregunta ya está creada
    }

    // Esperar a que Firestore confirme la creación antes de retornar
    // Verificar que el documento existe antes de continuar
    let verifyDoc = await getDoc(questionRef);
    let attempts = 0;
    while (!verifyDoc.exists() && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 200));
      verifyDoc = await getDoc(questionRef);
      attempts++;
    }

    if (!verifyDoc.exists()) {
      console.error("Error: La pregunta no se pudo verificar después de crearla");
      throw new ServiceError("questions/create-failed", "No se pudo verificar la creación de la pregunta");
    }

    // Usar firestoreQuestionToQuestion para asegurar consistencia con getQuestionById
    // Si falla, construir el objeto Question manualmente como fallback
    try {
      return await this.firestoreQuestionToQuestion(verifyDoc);
    } catch (error: any) {
      console.warn("Error al convertir pregunta desde Firestore, usando fallback:", error);
      // Fallback: construir Question manualmente con los datos del documento
      const data = verifyDoc.data();
      return {
        id: questionRef.id,
        title: data.title || title,
        description: data.description || description,
        authorId: data.authorId || author.id,
        authorName: data.authorName || author.name,
        isAnonymous: data.isAnonymous || Boolean(input.isAnonymous),
        category: data.category || input.category,
        tags: data.tags || [...tags],
        createdAt: data.createdAt ? this.timestampToIso(data.createdAt) : now,
        updatedAt: data.updatedAt ? this.timestampToIso(data.updatedAt) : now,
        answers: [], // Nueva pregunta sin respuestas aún
        viewedByUserId: data.viewedByUserId || {},
        viewsCount: data.viewsCount || 0,
        ratingsByUserId: data.ratingsByUserId || {},
        ratingAvg: data.ratingAvg || 0,
        ratingCount: data.ratingCount || 0,
        trophyAnswerId: data.trophyAnswerId || null,
      };
    }
  }

  async addAnswer(input: AddAnswerInput, author: User): Promise<Answer> {
    const content = input.content.trim();
    if (content.length < 2) {
      throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");
    }

    const question = await this.getQuestionById(input.questionId);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    const now = nowIso();
    const answerRef = doc(collection(db, "questions", input.questionId, "answers"));
    const answerData = {
      questionId: input.questionId,
      content,
      authorId: author.id,
      authorName: author.name,
      isAnonymous: Boolean(input.isAnonymous),
      createdAt: this.isoToTimestamp(now),
      updatedAt: this.isoToTimestamp(now),
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0,
      hasTrophy: false,
    };

    await setDoc(answerRef, answerData);

    // Actualizar contador de respuestas en la pregunta
    const questionRef = doc(db, "questions", input.questionId);
    await updateDoc(questionRef, {
      answersCount: increment(1),
      updatedAt: this.isoToTimestamp(now),
    });

    // Actualizar contador de respuestas del usuario
    const userRef = doc(db, "users", author.id);
    const userDoc = await getDoc(userRef);
    
    // Asegurar que answersCount exista (inicializar si no existe)
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentCount = userData.answersCount ?? 0;
      await updateDoc(userRef, {
        answersCount: currentCount + 1,
      });
    } else {
      // Si el documento no existe, crearlo con answersCount = 1
      await setDoc(userRef, {
        answersCount: 1,
        level: 1,
        xp: 0,
        rank: "Novato",
        questionsCount: 0,
        avgRating: 0,
      }, { merge: true });
    }

    await reputationService.addXp(author.id, XP_VALUES.ANSWER_PUBLISHED);

    const newAnswer: Answer = {
      id: answerRef.id,
      questionId: input.questionId,
      content,
      authorId: author.id,
      authorName: author.name,
      isAnonymous: Boolean(input.isAnonymous),
      createdAt: now,
      updatedAt: now,
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0,
    };

    if (question.authorId !== author.id) {
      await notificationsService.create(
        newAnswerNotification({ userId: question.authorId, questionId: question.id, answerId: newAnswer.id, fromUserId: author.id })
      );
    }

    const followedBy = await userDataService.getQuestionFollowers(question.id);
    for (const followerId of followedBy) {
      if (followerId !== question.authorId && followerId !== author.id) {
        await notificationsService.create(
          newAnswerNotification({ userId: followerId, questionId: question.id, answerId: newAnswer.id, fromUserId: author.id })
        );
      }
    }

    // Recalcular trofeo
    const updatedQuestion = await this.getQuestionById(input.questionId);
    if (updatedQuestion) {
      await this.updateTrophyForQuestion(updatedQuestion);
    }

    return newAnswer;
  }

  async registerUniqueView(questionId: string, viewer: User): Promise<Question> {
    const question = await this.getQuestionById(questionId);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    if (question.viewedByUserId[viewer.id]) {
      return question;
    }

    const questionRef = doc(db, "questions", questionId);
    const updatedViewedBy: Record<string, true> = { ...question.viewedByUserId, [viewer.id]: true };
    await updateDoc(questionRef, {
      viewedByUserId: updatedViewedBy,
      viewsCount: Object.keys(updatedViewedBy).length,
    });

    return {
      ...question,
      viewedByUserId: updatedViewedBy,
      viewsCount: Object.keys(updatedViewedBy).length,
    };
  }

  async updateQuestion(
    input: { id: string; title: string; description: string; isAnonymous: boolean; category: string; tags: string[] },
    author: User
  ): Promise<Question> {
    const question = await this.getQuestionById(input.id);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }
    if (question.authorId !== author.id) {
      throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la pregunta");
    }

    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 8) {
      throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    }
    if (description.length < 10) {
      throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");
    }

    if (!CATEGORIES.includes(input.category as any)) {
      throw new ServiceError("validation/invalid-argument", "Categoría inválida");
    }

    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5) {
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    }
    const invalidTags = tags.filter((tag) => !PREDEFINED_TAGS.includes(tag as any));
    if (invalidTags.length > 0) {
      throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);
    }

    const now = nowIso();
    const questionRef = doc(db, "questions", input.id);
    await updateDoc(questionRef, {
      title,
      description,
      isAnonymous: Boolean(input.isAnonymous),
      category: input.category,
      tags: [...tags],
      updatedAt: this.isoToTimestamp(now),
    });

    return await this.getQuestionById(input.id) as Question;
  }

  async updateAnswer(input: { questionId: string; answerId: string; content: string }, author: User): Promise<Answer> {
    const question = await this.getQuestionById(input.questionId);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    const answer = question.answers.find((a) => a.id === input.answerId);
    if (!answer) {
      throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    }
    if (answer.authorId !== author.id) {
      throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la respuesta");
    }

    const content = input.content.trim();
    if (content.length < 2) {
      throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");
    }

    const now = nowIso();
    const answerRef = doc(db, "questions", input.questionId, "answers", input.answerId);
    await updateDoc(answerRef, {
      content,
      updatedAt: this.isoToTimestamp(now),
    });

    return {
      ...answer,
      content,
      updatedAt: now,
    };
  }

  async rateAnswer(input: { questionId: string; answerId: string; value: number }, rater: User): Promise<Answer> {
    const question = await this.getQuestionById(input.questionId);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    const answer = question.answers.find((a) => a.id === input.answerId);
    if (!answer) {
      throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    }

    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");
    }
    if (answer.ratingsByUserId[rater.id] != null) {
      throw new ServiceError("validation/invalid-argument", "Solo puedes calificar una vez esta respuesta");
    }

    const updatedRatings = { ...answer.ratingsByUserId, [rater.id]: value };
    const all = Object.values(updatedRatings);
    const ratingCount = all.length;
    const ratingAvg = all.length ? Math.round((all.reduce((s, v) => s + v, 0) / all.length) * 10) / 10 : 0;

    const answerRef = doc(db, "questions", input.questionId, "answers", input.answerId);
    await updateDoc(answerRef, {
      ratingsByUserId: updatedRatings,
      ratingCount,
      ratingAvg,
      updatedAt: this.isoToTimestamp(nowIso()),
    });

    if (value >= 4 && answer.authorId !== rater.id) {
      await reputationService.addXp(answer.authorId, XP_VALUES.ANSWER_WELL_RATED);
    }

    if (answer.authorId !== rater.id) {
      await notificationsService.create(
        answerRatedNotification({
          userId: answer.authorId,
          questionId: question.id,
          answerId: answer.id,
          fromUserId: rater.id,
          rating: value,
          ratingAvg,
        })
      );
    }

    const updatedQuestion = await this.getQuestionById(input.questionId);
    if (updatedQuestion) {
      await this.updateTrophyForQuestion(updatedQuestion);
    }

    return {
      ...answer,
      ratingsByUserId: updatedRatings,
      ratingCount,
      ratingAvg,
      updatedAt: nowIso(),
    };
  }

  async rateQuestion(input: { questionId: string; value: number }, rater: User): Promise<Question> {
    const question = await this.getQuestionById(input.questionId);
    if (!question) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");
    }
    if (question.ratingsByUserId[rater.id] != null) {
      throw new ServiceError("validation/invalid-argument", "Solo puedes calificar una vez esta pregunta");
    }

    const updatedRatings = { ...question.ratingsByUserId, [rater.id]: value };
    const all = Object.values(updatedRatings);
    const ratingCount = all.length;
    const ratingAvg = all.length ? Math.round((all.reduce((s, v) => s + v, 0) / all.length) * 10) / 10 : 0;

    const questionRef = doc(db, "questions", input.questionId);
    await updateDoc(questionRef, {
      ratingsByUserId: updatedRatings,
      ratingCount,
      ratingAvg,
      updatedAt: this.isoToTimestamp(nowIso()),
    });

    if (value >= 4 && question.authorId !== rater.id) {
      await reputationService.addXp(question.authorId, XP_VALUES.QUESTION_WELL_RATED);
    }

    return await this.getQuestionById(input.questionId) as Question;
  }

  async listQuestionsByAuthorId(authorId: string): Promise<Question[]> {
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("authorId", "==", authorId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    const questions: Question[] = [];
    for (const questionDoc of snapshot.docs) {
      const question = await this.firestoreQuestionToQuestion(questionDoc);
      questions.push(question);
    }
    
    return questions;
  }

  async listAnswersByAuthorId(authorId: string): Promise<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>> {
    // Obtener todas las preguntas y buscar respuestas del autor
    const allQuestions = await this.listQuestions();
    const items: Array<{ questionId: string; answerId: string; content: string; createdAt: string }> = [];
    
    for (const question of allQuestions) {
      for (const answer of question.answers) {
        if (answer.authorId === authorId) {
          items.push({
            questionId: question.id,
            answerId: answer.id,
            content: answer.content,
            createdAt: answer.createdAt,
          });
        }
      }
    }
    
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async syncQuestionsCount(userId: string): Promise<number> {
    // Contar las preguntas reales del usuario en Firestore
    const questionsRef = collection(db, "questions");
    const q = query(
      questionsRef,
      where("authorId", "==", userId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    const realCount = snapshot.size;

    // Actualizar el contador en el documento del usuario
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await updateDoc(userRef, {
        questionsCount: realCount,
      });
    } else {
      // Si el documento no existe, crearlo
      await setDoc(userRef, {
        questionsCount: realCount,
        level: 1,
        xp: 0,
        rank: "Novato",
        answersCount: 0,
        avgRating: 0,
      }, { merge: true });
    }

    return realCount;
  }

  async syncAuthorName(authorId: string, newName: string): Promise<void> {
    // Actualizar nombre en todas las preguntas del autor
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("authorId", "==", authorId));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    for (const questionDoc of snapshot.docs) {
      batch.update(questionDoc.ref, { authorName: newName });
      
      // Actualizar nombre en todas las respuestas del autor en esta pregunta
      const answersSnapshot = await getDocs(collection(db, "questions", questionDoc.id, "answers"));
      for (const answerDoc of answersSnapshot.docs) {
        const answerData = answerDoc.data();
        if (answerData.authorId === authorId) {
          batch.update(answerDoc.ref, { authorName: newName });
        }
      }
    }
    
    await batch.commit();
  }

  async deleteQuestion(questionId: string, adminUser: User): Promise<void> {
    if (adminUser.role !== "ADMIN") {
      throw new ServiceError("validation/invalid-argument", "Solo administradores pueden eliminar preguntas");
    }

    const questionRef = doc(db, "questions", questionId);
    const questionDoc = await getDoc(questionRef);
    
    if (!questionDoc.exists()) {
      throw new ServiceError("questions/not-found", "Pregunta no encontrada");
    }

    // Eliminar todas las respuestas primero
    const answersSnapshot = await getDocs(collection(db, "questions", questionId, "answers"));
    const batch = writeBatch(db);
    for (const answerDoc of answersSnapshot.docs) {
      batch.delete(answerDoc.ref);
    }
    batch.delete(questionRef);
    await batch.commit();

    // Actualizar contador del usuario
    const authorId = questionDoc.data().authorId;
    if (authorId) {
      const userRef = doc(db, "users", authorId);
      await updateDoc(userRef, {
        questionsCount: increment(-1),
      });
    }
  }

  async deleteAnswer(questionId: string, answerId: string, adminUser: User): Promise<void> {
    if (adminUser.role !== "ADMIN") {
      throw new ServiceError("validation/invalid-argument", "Solo administradores pueden eliminar respuestas");
    }

    const answerRef = doc(db, "questions", questionId, "answers", answerId);
    const answerDoc = await getDoc(answerRef);
    
    if (!answerDoc.exists()) {
      throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    }

    await deleteDoc(answerRef);

    // Actualizar contador de respuestas en la pregunta
    const questionRef = doc(db, "questions", questionId);
    await updateDoc(questionRef, {
      answersCount: increment(-1),
    });

    // Actualizar contador del usuario
    const authorId = answerDoc.data().authorId;
    if (authorId) {
      const userRef = doc(db, "users", authorId);
      await updateDoc(userRef, {
        answersCount: increment(-1),
      });
    }
  }

  reset(): void {
    // No hay nada que resetear en Firestore (esto es para testing)
  }
}

