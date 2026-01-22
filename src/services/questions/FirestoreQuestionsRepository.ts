import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  writeBatch,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import type { Answer, Question, User } from "../../domain/types";
import type { Reply } from "../../domain/reply";
import { ServiceError } from "../errors";
import { nowIso } from "../utils";
import type { AddAnswerInput, CreateQuestionInput, QuestionsRepository } from "./QuestionsRepository";
import { notificationsService } from "../notifications/notificationsService";
import { answerRatedNotification, newAnswerNotification, questionRatedNotification } from "../notifications/factories";
import { CATEGORIES, PREDEFINED_TAGS } from "../categories/categoriesData";
import { userDataService } from "../userData/userDataService";
import { db, auth } from "../../firebase/firebase";
import { FIRESTORE_PATHS } from "./paths";
import { getXpByStars, calculateLevel, calculateRank } from "../reputation/reputationUtils";
import { syncXpChangeWithSnapshots } from "../reputation/xpSyncUtils";

function requireDb() {
  if (!db) throw new Error("Firebase db no está inicializado");
  const projectId = db.app.options.projectId;
  if (!projectId) throw new Error("Firebase projectId no está configurado");
}

function requireAuthUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ServiceError("auth/not-authenticated", "No estás autenticado");
  return uid;
}

function isValidStars(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
}

function safeErr(e: any): string {
  return e?.message || e?.code || String(e);
}

export class FirestoreQuestionsRepository implements QuestionsRepository {
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) return timestamp.toDate().toISOString();
    if (typeof timestamp === "string") return timestamp;
    return new Date().toISOString();
  }

  private computeRatingStats(ratingsByUserId: Record<string, number>) {
    const all = Object.values(ratingsByUserId);
    const ratingCount = all.length;
    const ratingAvg =
      ratingCount > 0 ? Math.round((all.reduce((s, v) => s + v, 0) / ratingCount) * 10) / 10 : 0;
    return { ratingAvg, ratingCount };
  }


  private async loadAnswersForQuestion(questionId: string): Promise<Answer[]> {
    requireDb();

    const answers: Answer[] = [];
    const answersRef = collection(db, FIRESTORE_PATHS.answers(questionId));

    let snap;
    try {
      snap = await getDocs(query(answersRef, orderBy("createdAt", "desc")));
    } catch (e: any) {
      console.warn(`[loadAnswersForQuestion] orderBy fallback: ${safeErr(e)}`);
      snap = await getDocs(answersRef);
    }

    for (const answerDoc of snap.docs) {
      const a = answerDoc.data();
      const answerId = answerDoc.id;

      // ✅ Usar ratingAvg y ratingCount directamente del documento (actualizados por Cloud Functions o cliente)
      const ratingAvg = Number(a.ratingAvg || 0);
      const ratingCount = Number(a.ratingCount || 0);
      
      // ✅ ISSUE 1 FIX: Cargar rating del usuario actual desde Firestore para detectar si ya calificó
      const ratingsByUserId: Record<string, number> = {};
      const currentUserId = auth.currentUser?.uid;
      if (currentUserId) {
        try {
          const ratingRef = doc(db, "questions", questionId, "answers", answerId, "ratings", currentUserId);
          const ratingSnap = await getDoc(ratingRef);
          if (ratingSnap.exists()) {
            const ratingData = ratingSnap.data();
            const ratingValue = Number(ratingData?.value || ratingData?.stars || 0);
            if (isValidStars(ratingValue)) {
              ratingsByUserId[currentUserId] = ratingValue;
              console.log(`[loadAnswersForQuestion] Rating UI disabled for user: questions/${questionId}/answers/${answerId}/ratings/${currentUserId} = ${ratingValue} stars`);
            }
          }
        } catch (e: any) {
          // Best-effort: si falla la lectura del rating, continuar sin bloquear
          console.warn(`[loadAnswersForQuestion] No se pudo leer rating del usuario actual para respuesta ${answerId} (best-effort): ${safeErr(e)}`);
        }
      }

      answers.push({
        id: answerId,
        questionId,
        content: a.content || "",
        authorId: a.authorId || "",
        authorName: a.authorName || "",
        isAnonymous: Boolean(a.isAnonymous),
        createdAt: this.timestampToIso(a.createdAt),
        updatedAt: this.timestampToIso(a.updatedAt),
        ratingsByUserId,
        ratingAvg,
        ratingCount,
      });
    }

    answers.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
    return answers;
  }

  private async firestoreQuestionToQuestion(questionDoc: any): Promise<Question> {
    requireDb();

    const questionId = questionDoc.id;
    const data = questionDoc.data();
    if (!questionId || !data) throw new Error("Documento inválido");

    const answers = await this.loadAnswersForQuestion(questionId);
    
    // ✅ Usar ratingAvg y ratingCount directamente del documento (actualizados por Cloud Functions o cliente)
    // Ya no leemos ratings raw para evitar permission-denied y mejorar rendimiento
    const ratingAvg = Number(data.ratingAvg || 0);
    const ratingCount = Number(data.ratingCount || 0);
    
    // ✅ PROBLEMA 1 FIX: Cargar rating del usuario actual desde Firestore para detectar si ya calificó
    const ratingsByUserId: Record<string, number> = {};
    const currentUserId = auth.currentUser?.uid;
    if (currentUserId) {
      try {
        const ratingRef = doc(db, "questions", questionId, "ratings", currentUserId);
        const ratingSnap = await getDoc(ratingRef);
        if (ratingSnap.exists()) {
          const ratingData = ratingSnap.data();
          const ratingValue = Number(ratingData?.value || ratingData?.stars || 0);
          if (isValidStars(ratingValue)) {
            ratingsByUserId[currentUserId] = ratingValue;
            console.log(`[firestoreQuestionToQuestion] Rating UI disabled for user: questions/${questionId}/ratings/${currentUserId} = ${ratingValue} stars`);
          }
        }
      } catch (e: any) {
        // Best-effort: si falla la lectura del rating, continuar sin bloquear
        console.warn(`[firestoreQuestionToQuestion] No se pudo leer rating del usuario actual (best-effort): ${safeErr(e)}`);
      }
    }

    const now = nowIso();

    return {
      id: questionId,
      title: data.title || "Sin título",
      description: data.description || "",
      authorId: data.authorId || "",
      authorName: data.authorName || "Usuario desconocido",
      isAnonymous: Boolean(data.isAnonymous),
      category: data.category || "General",
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt ? this.timestampToIso(data.createdAt) : now,
      updatedAt: data.updatedAt ? this.timestampToIso(data.updatedAt) : now,
      answers,
      viewedByUserId: data.viewedByUserId || {},
      viewsCount: Number(data.viewsCount || 0),
      ratingsByUserId,
      ratingAvg,
      ratingCount,
      // ✅ La copa la asigna Cloud Functions (server-side)
      trophyAnswerId: data.trophyAnswerId || data.bestAnswerId || null,
    };
  }

  async listQuestions(): Promise<Question[]> {
    requireDb();

    const questionsRef = collection(db, FIRESTORE_PATHS.QUESTIONS);

    let snap;
    try {
      snap = await getDocs(query(questionsRef, orderBy("createdAt", "desc")));
    } catch (e: any) {
      console.warn(`[listQuestions] orderBy fallback: ${safeErr(e)}`);
      snap = await getDocs(questionsRef);
    }

    const out: Question[] = [];
    for (const d of snap.docs) {
      try {
        out.push(await this.firestoreQuestionToQuestion(d));
      } catch (e: any) {
        console.error(`[listQuestions] error doc=${d.id}: ${safeErr(e)}`);
      }
    }

    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }

  async getQuestionById(id: string): Promise<Question | null> {
    requireDb();

    const qid = (id || "").trim();
    if (!qid) {
      console.warn(`[getQuestionById] ID inválido: "${id}"`);
      throw new ServiceError("validation/invalid-argument", "ID de pregunta inválido");
    }

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, qid);

    const maxRetries = 3;
    const delays = [100, 300, 500];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const snap = await getDoc(questionRef);

        if (snap.exists()) {
          console.log(`[getQuestionById] ✓ Pregunta encontrada: ${qid} (intento ${attempt + 1})`);
          return this.firestoreQuestionToQuestion(snap);
        }

        // ✅ Doc no existe (snap.exists() == false)
        // No es un error de permisos, simplemente no existe
        if (attempt < maxRetries) {
          const delay = delays[attempt] || 500;
          console.log(`[getQuestionById] ⏳ Pregunta no encontrada en intento ${attempt + 1}, reintentando en ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.warn(`[getQuestionById] ❌ Pregunta no encontrada después de ${maxRetries + 1} intentos: ${qid}`);
        return null; // ✅ Retornar null cuando el doc no existe (no lanzar error)
      } catch (e: any) {
        const errorCode = e?.code || "unknown";
        const errorMessage = safeErr(e);

        // ✅ Diferenciar permission-denied: NO es "no encontrada", es error de permisos
        if (errorCode === "permission-denied") {
          console.error(`[getQuestionById] ❌ PERMISSION-DENIED: ${qid} - ${errorMessage}`);
          // Lanzar error específico para que el frontend lo maneje correctamente
          throw new ServiceError("permission-denied", `No tienes permisos para ver esta pregunta: ${errorMessage}`);
        }

        if (errorCode === "failed-precondition") {
          console.warn(`[getQuestionById] ⚠️ failed-precondition (índice faltante), reintentando...`);
          if (attempt < maxRetries) {
            const delay = delays[attempt] || 500;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }

        if (attempt === maxRetries) {
          console.error(`[getQuestionById] ❌ Error después de ${maxRetries + 1} intentos: ${errorCode} - ${errorMessage}`);
          throw new ServiceError("questions/read-failed", `Error al leer la pregunta: ${errorMessage}`);
        }
      }
    }

    return null;
  }

  async createQuestion(input: CreateQuestionInput, author: User): Promise<Question> {
    requireDb();
    const uid = requireAuthUid();

    const title = input.title.trim();
    const description = input.description.trim();

    if (title.length < 8) throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    if (description.length < 10)
      throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");
    if (!CATEGORIES.includes(input.category as any)) throw new ServiceError("validation/invalid-argument", "Categoría inválida");

    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5)
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    const invalidTags = tags.filter((t) => !PREDEFINED_TAGS.includes(t as any));
    if (invalidTags.length) throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);

    let authorName = (author?.name || "").trim() || "Usuario";
    try {
      const u = await getDoc(doc(db, "users", uid));
      if (u.exists()) {
        const ud = u.data();
        authorName = (ud?.name || ud?.displayName || authorName).trim() || authorName;
      }
    } catch {}

    const questionRef = doc(collection(db, FIRESTORE_PATHS.QUESTIONS));

    const questionData = {
      title,
      description,
      authorId: uid,
      authorName,
      isAnonymous: Boolean(input.isAnonymous),
      category: input.category,
      tags: [...tags],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      viewsCount: 0,
      answersCount: 0,
      trophyAnswerId: null,
      bestAnswerId: null,
      status: "active" as const,
    };

    // ✅ PASO 1: Crear la pregunta (operación crítica)
    try {
      await setDoc(questionRef, questionData);
      console.log(`[createQuestion] ✓ Pregunta creada: ${questionRef.id}`);
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      if (errorCode === "permission-denied") {
        throw new ServiceError("permission-denied", "No tienes permisos para crear preguntas");
      }
      throw new ServiceError("questions/create-failed", `Error al crear la pregunta: ${safeErr(e)}`);
    }

    // ✅ PASO 2: Actualizar users/{uid}.questionsCount (best-effort, no debe bloquear)
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          questionsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        console.log(`[createQuestion] ✓ questionsCount actualizado para usuario ${uid}`);
      } else {
        // Si el documento no existe, crearlo con valores iniciales
        const userEmail = auth.currentUser?.email || author.email || "";
        await setDoc(
          userRef,
          {
            uid,
            name: authorName,
            displayName: authorName,
            email: userEmail,
            role: "USER",
            level: 1,
            xp: 0,
            rank: "Novato",
            questionsCount: 1,
            answersCount: 0,
            savedCount: 0,
            followedCount: 0,
            avgRating: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`[createQuestion] ✓ Documento de usuario creado para ${uid}`);
      }
    } catch (e: any) {
      // ✅ Best-effort: si falla la actualización de users, solo loggear warning
      const errorCode = e?.code || "unknown";
      const errorMessage = safeErr(e);
      console.warn(`[createQuestion] ⚠️ No se pudo actualizar users/${uid}.questionsCount (best-effort): ${errorCode} - ${errorMessage}`);
      // ✅ NO lanzar error - la pregunta ya está creada, esto es secundario
    }

    const questionId = questionRef.id;
    const maxRetries = 3;
    const delays = [150, 300, 500];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const created = await getDoc(questionRef);
        if (created.exists()) {
          console.log(`[createQuestion] ✓ Pregunta verificada después de transacción: ${questionId} (intento ${attempt + 1})`);
          return this.firestoreQuestionToQuestion(created);
        }

        if (attempt < maxRetries) {
          const delay = delays[attempt] || 500;
          console.log(`[createQuestion] ⏳ Esperando propagación (intento ${attempt + 1}/${maxRetries + 1})...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.error(`[createQuestion] ❌ No se pudo verificar la creación después de ${maxRetries + 1} intentos: ${questionId}`);
        throw new ServiceError("questions/create-failed", "No se pudo verificar la creación de la pregunta");
      } catch (e: any) {
        const errorCode = e?.code || "unknown";
        if (errorCode === "permission-denied") {
          throw new ServiceError("permission-denied", "No tienes permisos para crear preguntas");
        }
        if (attempt === maxRetries) {
          console.error(`[createQuestion] ❌ Error después de ${maxRetries + 1} intentos: ${safeErr(e)}`);
          throw new ServiceError("questions/create-failed", `Error al verificar la creación: ${safeErr(e)}`);
        }
        const delay = delays[attempt] || 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new ServiceError("questions/create-failed", "No se pudo verificar la creación de la pregunta");
  }

  async addAnswer(input: AddAnswerInput, author: User): Promise<Answer> {
    requireDb();
    const uid = requireAuthUid();

    const content = input.content.trim();
    if (content.length < 2) throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, input.questionId);
    const questionSnap = await getDoc(questionRef).catch((e: any) => {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para ver esta pregunta");
      throw new ServiceError("questions/read-failed", `Error al leer la pregunta: ${safeErr(e)}`);
    });

    if (!questionSnap.exists()) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const qd = questionSnap.data();
    if (qd?.authorId === uid) throw new ServiceError("validation/invalid-argument", "No puedes responder tu propia pregunta");

    let authorName = (author?.name || "").trim() || "Usuario";
    try {
      const u = await getDoc(doc(db, "users", uid));
      if (u.exists()) {
        const ud = u.data();
        authorName = (ud?.name || ud?.displayName || authorName).trim() || authorName;
      }
    } catch {}

    const answersRef = collection(db, FIRESTORE_PATHS.answers(input.questionId));
    const answerRef = doc(answersRef);
    const path = `questions/${input.questionId}/answers/${answerRef.id}`;

    // ✅ Payload según reglas: authorId == uid, content (string), questionId opcional pero si existe debe coincidir
    const answerData = {
      authorId: uid, // ✅ Requerido: authorId == uid()
      content, // ✅ Requerido: content is string
      questionId: input.questionId, // ✅ Opcional según reglas, pero incluimos para consistencia
      authorName,
      isAnonymous: Boolean(input.isAnonymous),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ratingSum: 0, // Inicializado para que Cloud Functions pueda actualizarlo
      ratingCount: 0,
      ratingAvg: 0,
    };

    try {
      // ✅ Loguear payload exacto antes de escribir
      console.log(`[addAnswer] 📝 Escribiendo respuesta en ${path}:`, {
        path,
        payload: {
          authorId: uid,
          content: content.substring(0, 50) + (content.length > 50 ? "..." : ""), // Preview del contenido
          questionId: input.questionId,
          authorName,
          isAnonymous: Boolean(input.isAnonymous),
          createdAt: "<serverTimestamp>",
          updatedAt: "<serverTimestamp>",
        },
      });

      await setDoc(answerRef, answerData);
      console.log(`[addAnswer] ✓ Respuesta guardada exitosamente: ${path}`);
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      const errorMessage = safeErr(e);
      console.error(`[addAnswer] ❌ Error en ${path}:`, {
        errorCode,
        errorMessage,
        path,
        payload: {
          authorId: uid,
          questionId: input.questionId,
          contentLength: content.length,
        },
      });
      if (errorCode === "permission-denied") {
        throw new ServiceError("permission-denied", "No tienes permisos para crear respuestas en esta pregunta");
      }
      throw new ServiceError("answers/create-failed", `Error al crear la respuesta: ${errorMessage}`);
    }

    updateDoc(questionRef, { answersCount: increment(1), updatedAt: serverTimestamp() }).catch((e) =>
      console.warn(`[addAnswer] answersCount no actualizado: ${safeErr(e)}`)
    );

    const userRef = doc(db, "users", uid);
    getDoc(userRef)
      .then((u) => {
        if (u.exists()) {
          return updateDoc(userRef, { answersCount: (u.data()?.answersCount ?? 0) + 1, updatedAt: serverTimestamp() });
        }
        const userEmail = auth.currentUser?.email || author.email || "";
        return setDoc(
          userRef,
          {
            uid,
            answersCount: 1,
            level: 1,
            xp: 0,
            rank: "Novato",
            questionsCount: 0,
            savedCount: 0,
            followedCount: 0,
            avgRating: 0,
            name: authorName,
            displayName: authorName,
            email: userEmail,
            role: "USER",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      })
      .catch((e) => console.warn(`[addAnswer] user answersCount no actualizado: ${safeErr(e)}`));

    const tempAnswer: Answer = {
      id: answerRef.id,
      questionId: input.questionId,
      content,
      authorId: uid,
      authorName,
      isAnonymous: Boolean(input.isAnonymous),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ratingsByUserId: {},
      ratingAvg: 0,
      ratingCount: 0,
    };

    if (qd?.authorId && qd.authorId !== uid) {
      notificationsService
        .create(
          newAnswerNotification({
            userId: qd.authorId,
            questionId: input.questionId,
            answerId: tempAnswer.id,
            fromUserId: uid,
          })
        )
        .catch((e) => console.warn(`[addAnswer] notif author fail: ${safeErr(e)}`));
    }

    userDataService
      .getQuestionFollowers(input.questionId)
      .then((followers) =>
        Promise.all(
          followers
            .filter((f) => f !== qd?.authorId && f !== uid)
            .map((f) =>
              notificationsService.create(
                newAnswerNotification({
                  userId: f,
                  questionId: input.questionId,
                  answerId: tempAnswer.id,
                  fromUserId: uid,
                })
              )
            )
        )
      )
      .catch((e) => console.warn(`[addAnswer] notif followers fail: ${safeErr(e)}`));

    try {
      const q2 = await this.getQuestionById(input.questionId);
      const created = q2?.answers?.find((a) => a.id === answerRef.id);
      if (created) return created;
    } catch {}

    return tempAnswer;
  }

  async registerUniqueView(questionId: string, _viewer: User): Promise<Question> {
    requireDb();
    const uid = auth.currentUser?.uid;

    const question = await this.getQuestionById(questionId);
    if (!question) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    if (!uid) return question;

    if (question.viewedByUserId?.[uid]) {
      return question;
    }

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, questionId);

    try {
      const questionSnap = await getDoc(questionRef);
      if (!questionSnap.exists()) {
        console.warn(`[registerUniqueView] Pregunta no existe: ${questionId}`);
        return question;
      }

      // ✅ Según reglas: solo el autor puede actualizar la pregunta
      // Si el usuario no es el autor, no podemos actualizar viewedByUserId/viewsCount
      // Esto es opcional, así que si falla por permisos, simplemente retornamos la pregunta sin actualizar
      const currentData = questionSnap.data();
      const isAuthor = currentData?.authorId === uid;

      if (!isAuthor) {
        // ✅ No es el autor, no podemos actualizar (reglas lo bloquean)
        // Retornar la pregunta sin actualizar - esto es aceptable
        console.log(`[registerUniqueView] Usuario ${uid} no es autor, omitiendo actualización de vista`);
        return question;
      }

      const currentViewedBy = currentData?.viewedByUserId || {};

      if (!currentViewedBy[uid]) {
        const newViewedBy = { ...currentViewedBy, [uid]: true };
        const newViewsCount = Object.keys(newViewedBy).length;

        await updateDoc(questionRef, {
          viewedByUserId: newViewedBy,
          viewsCount: newViewsCount,
          updatedAt: serverTimestamp(),
        });

        console.log(`[registerUniqueView] ✓ Vista registrada para usuario ${uid}`);
      }

      const updated = await this.getQuestionById(questionId);
      return updated ?? question;
    } catch (e: any) {
      // ✅ Si falla por permission-denied u otro error, no es crítico
      // Retornar la pregunta sin actualizar (mejor que fallar)
      const errorCode = e?.code || "unknown";
      if (errorCode === "permission-denied") {
        console.log(`[registerUniqueView] ⚠️ Permission-denied (esperado si no es autor): ${questionId}`);
      } else {
        console.warn(`[registerUniqueView] ⚠️ No se pudo registrar vista: ${safeErr(e)}`);
      }
      return question;
    }
  }

  async updateQuestion(
    input: { id: string; title: string; description: string; isAnonymous: boolean; category: string; tags: string[] },
    _author: User
  ): Promise<Question> {
    const q = await this.getQuestionById(input.id);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const uid = requireAuthUid();
    if (q.authorId !== uid) throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la pregunta");

    const title = input.title.trim();
    const description = input.description.trim();

    if (title.length < 8) throw new ServiceError("validation/invalid-argument", "El título debe tener al menos 8 caracteres");
    if (description.length < 10)
      throw new ServiceError("validation/invalid-argument", "La descripción debe tener al menos 10 caracteres");
    if (!CATEGORIES.includes(input.category as any)) throw new ServiceError("validation/invalid-argument", "Categoría inválida");

    const tags = input.tags || [];
    if (tags.length < 1 || tags.length > 5)
      throw new ServiceError("validation/invalid-argument", "Debes seleccionar entre 1 y 5 etiquetas");
    const invalidTags = tags.filter((t) => !PREDEFINED_TAGS.includes(t as any));
    if (invalidTags.length) throw new ServiceError("validation/invalid-argument", `Etiquetas inválidas: ${invalidTags.join(", ")}`);

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, input.id);
    try {
      await updateDoc(questionRef, {
        title,
        description,
        isAnonymous: Boolean(input.isAnonymous),
        category: input.category,
        tags: [...tags],
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para editar esta pregunta");
      throw new ServiceError("questions/update-failed", `Error al actualizar la pregunta: ${safeErr(e)}`);
    }

    const updated = await this.getQuestionById(input.id);
    if (!updated) throw new ServiceError("questions/not-found", "No se pudo recargar la pregunta después de actualizarla");
    return updated;
  }

  async updateAnswer(input: { questionId: string; answerId: string; content: string }, _author: User): Promise<Answer> {
    const q = await this.getQuestionById(input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const uid = requireAuthUid();
    const answer = q.answers.find((a) => a.id === input.answerId);
    if (!answer) throw new ServiceError("questions/not-found", "Respuesta no encontrada");
    if (answer.authorId !== uid) throw new ServiceError("validation/invalid-argument", "Solo el autor puede editar la respuesta");

    const content = input.content.trim();
    if (content.length < 2) throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");

    const answerRef = doc(db, FIRESTORE_PATHS.answer(input.questionId, input.answerId));
    try {
      await updateDoc(answerRef, { content, updatedAt: serverTimestamp() });
    } catch (e: any) {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para editar esta respuesta");
      throw new ServiceError("answers/update-failed", `Error al actualizar la respuesta: ${safeErr(e)}`);
    }

    const q2 = await this.getQuestionById(input.questionId);
    const updated = q2?.answers.find((a) => a.id === input.answerId);
    return (
      updated ?? {
        ...answer,
        content,
        updatedAt: nowIso(),
      }
    );
  }

  // ✅ Ratings: cliente SOLO escribe el rating.
  // ✅ XP y trofeos los calcula Cloud Functions (server-side).
  // ✅ RATING SCOPE ENFORCEMENT: Answer ratings are for display/trophy purposes only.
  //    Answer ratings should NOT grant XP directly (only trophies grant XP).
  //    This method only writes the rating document; XP is handled server-side.
  async rateAnswer(input: { questionId: string; answerId: string; value: number }, _rater: User): Promise<Answer> {
    requireDb();
    const raterId = requireAuthUid();

    const ratingValue = Number(input.value);
    if (!isValidStars(ratingValue)) throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");

    const answerRef = doc(db, "questions", input.questionId, "answers", input.answerId);
    const ratingRef = doc(db, "questions", input.questionId, "answers", input.answerId, "ratings", raterId);
    const ratingsRef = collection(db, "questions", input.questionId, "answers", input.answerId, "ratings");
    const path = `questions/${input.questionId}/answers/${input.answerId}/ratings/${raterId}`;

    // ✅ Verificar si el rating ya existe ANTES de hacer cualquier cosa
    const existingRatingSnap = await getDoc(ratingRef);
    if (existingRatingSnap.exists()) {
      console.log(`[rateAnswer] Rating ignorado: usuario ya calificó esta respuesta (${path})`);
      const q = await this.getQuestionById(input.questionId);
      if (!q) throw new ServiceError("questions/not-found", "No se pudo recargar la pregunta");
      const a = q.answers.find((a) => a.id === input.answerId);
      if (!a) throw new ServiceError("questions/not-found", "Respuesta no encontrada");
      return a;
    }

    // ✅ Leer TODOS los ratings de la respuesta ANTES de la transacción
    const ratingsSnap = await getDocs(ratingsRef);
    
    // Construir objeto ratingsByUserId desde todos los ratings existentes
    const ratingsByUserId: Record<string, number> = {};
    for (const ratingDoc of ratingsSnap.docs) {
      const ratingData = ratingDoc.data();
      const userId = ratingDoc.id;
      const value = Number(ratingData?.value);
      if (isValidStars(value)) {
        ratingsByUserId[userId] = value;
      }
    }

    // ✅ Agregar el nuevo rating (primera vez que este usuario califica)
    ratingsByUserId[raterId] = ratingValue;

    // Recalcular ratingAvg y ratingCount
    const { ratingAvg, ratingCount } = this.computeRatingStats(ratingsByUserId);

    // ✅ Payload mínimo según reglas: value (int 1-5), userId opcional pero si existe debe coincidir
    const ratingPayload = {
      value: ratingValue, // ✅ Requerido: value is int && value >= 1 && value <= 5
      userId: raterId, // ✅ Opcional según reglas, pero incluimos para consistencia
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      // ✅ Loguear payload exacto antes de escribir
      console.log(`[rateAnswer] 📝 Iniciando transacción para rating en ${path}:`, {
        path,
        payload: {
          value: ratingValue,
          userId: raterId,
          createdAt: "<serverTimestamp>",
          updatedAt: "<serverTimestamp>",
        },
      });

      // ✅ Usar transacción para garantizar consistencia
      await runTransaction(db, async (tx) => {
        // ============================================
        // PHASE 1: ALL READS FIRST (MANDATORY)
        // ============================================
        
        // 1. Read answer document
        const answerSnap = await tx.get(answerRef);
        if (!answerSnap.exists()) {
          throw new ServiceError("questions/not-found", "Respuesta no encontrada");
        }

        const answerData = answerSnap.data();
        const authorId = answerData?.authorId || null;
        
        if (!authorId) {
          throw new ServiceError("validation/invalid-argument", "No se pudo obtener el autor de la respuesta");
        }

        // 2. Validate: user is NOT the author
        if (authorId === raterId) {
          throw new ServiceError("validation/invalid-argument", "No puedes calificar tu propia respuesta");
        }

        // 3. Read rating document (verify user has NOT rated before)
        const currentRatingSnap = await tx.get(ratingRef);
        if (currentRatingSnap.exists()) {
          console.log(`[rateAnswer] Rating bloqueado: usuario ya calificó esta respuesta (${path}) - ONE-TIME rating enforced`);
          throw new ServiceError("validation/invalid-argument", "Ya calificaste esta respuesta. Solo puedes calificar una vez.");
        }

        // 4. Read user document (for XP grant)
        const userRef = doc(db, "users", authorId);
        const userSnap = await tx.get(userRef);
        
        // 5. Read publicProfile document (for XP grant)
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        const publicProfileSnap = await tx.get(publicProfileRef);
        
        console.log(`[rateAnswer] all reads completed`);

        // ============================================
        // PHASE 2: ALL WRITES (AFTER ALL READS)
        // ============================================
        
        // 1. Create rating document
        tx.set(ratingRef, ratingPayload);
        console.log(`[rateAnswer] rating created`);

        // 2. Update answer document with aggregated stats
        tx.update(answerRef, {
          ratingAvg,
          ratingCount,
          updatedAt: serverTimestamp(),
        });
        console.log(`[rateAnswer] answer updated with ratingAvg=${ratingAvg}, ratingCount=${ratingCount}`);

        // 3. Grant XP (only on first rating, rater !== author)
        const xpToAdd = getXpByStars(ratingValue);
        if (xpToAdd > 0) {
          const userEmail = auth.currentUser?.email || "";
          const newXp = syncXpChangeWithSnapshots(
            tx,
            db,
            authorId,
            userSnap,
            publicProfileSnap,
            xpToAdd,
            userEmail
          );
          const newLevel = calculateLevel(newXp);
          const newRank = calculateRank(newLevel);
          
          console.log(`[rateAnswer] XP granted to author: ${xpToAdd} XP a usuario ${authorId} por rating de ${ratingValue} estrellas (nuevo XP: ${newXp}, nivel: ${newLevel}, rango: ${newRank})`);
        }
      });

      console.log(`[rateAnswer] ✓ Rating guardado exitosamente: ${path}, value=${ratingValue}`);
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      const errorMessage = safeErr(e);
      
      // ✅ Manejar errores específicos de ServiceError
      if (e instanceof ServiceError) {
        throw e;
      }

      console.error(`[rateAnswer] ❌ Error en ${path}:`, {
        errorCode,
        errorMessage,
        path,
        payload: ratingPayload,
      });
      
      if (errorCode === "permission-denied") {
        throw new ServiceError("permission-denied", "No tienes permisos para calificar esta respuesta");
      }
      throw new ServiceError("ratings/create-failed", `Error al calificar la respuesta: ${errorMessage}`);
    }

    // ✅ Obtener la respuesta actualizada para notificaciones y retorno
    const q = await this.getQuestionById(input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "No se pudo recargar la pregunta después de calificar");
    
    const updated = q.answers.find((a) => a.id === input.answerId);
    if (!updated) throw new ServiceError("questions/not-found", "Respuesta no encontrada después de calificar");

    // ✅ Recalculate and persist author's average rating including BOTH question and answer ratings
    // This must be done AFTER transaction to avoid read-after-write issues
    try {
      const authorId = updated.authorId;
      if (authorId && authorId !== raterId) {
        // ✅ Calculate avgRating including both question and answer ratings
        const averageRating = await this.calculateAvgRatingIncludingAnswers(authorId);
        
        // ✅ Update users/{userId} FIRST (source of truth)
        const userRef = doc(db, "users", authorId);
        await updateDoc(userRef, {
          avgRating: averageRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          // If document doesn't exist, create it
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              uid: authorId,
              avgRating: averageRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });
        
        // ✅ Then update publicProfiles/{userId} as projection of users/{userId}
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        await updateDoc(publicProfileRef, {
          avgRating: averageRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          // If document doesn't exist, create it
          const existingSnap = await getDoc(publicProfileRef);
          if (!existingSnap.exists()) {
            await setDoc(publicProfileRef, {
              userId: authorId,
              uid: authorId,
              avgRating: averageRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });
        
        console.log(`[rateAnswer] ✓ Average rating updated for author ${authorId}: ${averageRating} (including answer ratings) - synced to users and publicProfiles`);
      }
    } catch (e: any) {
      // Best-effort: don't break rating flow if average calculation fails
      console.warn(`[rateAnswer] ⚠️ Error calculating average rating (best-effort): ${safeErr(e)}`);
    }

    // Notificación (secundario)
    try {
      await notificationsService.create(
        answerRatedNotification({
          userId: updated.authorId,
          questionId: input.questionId,
          answerId: updated.id,
          fromUserId: raterId,
          rating: ratingValue,
          ratingAvg: updated.ratingAvg,
        })
      );
    } catch (e: any) {
      console.warn(`[rateAnswer] notif fail: ${safeErr(e)}`);
    }

    return updated;
  }

  async rateQuestion(input: { questionId: string; value: number }, _rater: User): Promise<Question> {
    requireDb();
    const raterId = requireAuthUid();

    const ratingValue = Number(input.value);
    if (!isValidStars(ratingValue)) throw new ServiceError("validation/invalid-argument", "La calificación debe ser entre 1 y 5");

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, input.questionId);
    const ratingRef = doc(db, "questions", input.questionId, "ratings", raterId);
    const ratingsRef = collection(db, "questions", input.questionId, "ratings");
    const path = `questions/${input.questionId}/ratings/${raterId}`;

    // ✅ Verificar si el rating ya existe ANTES de hacer cualquier cosa
    // Esto previene re-calificaciones y asegura que XP solo se otorgue una vez
    const existingRatingSnap = await getDoc(ratingRef);
    if (existingRatingSnap.exists()) {
      console.log(`[rateQuestion] Rating ignorado: usuario ya calificó esta pregunta (${path})`);
      // ✅ Retornar la pregunta actual sin hacer cambios (silenciosamente, sin error)
      const q = await this.getQuestionById(input.questionId);
      if (!q) throw new ServiceError("questions/not-found", "No se pudo recargar la pregunta");
      return q;
    }

    // ✅ Payload con ambos campos: value (para compatibilidad) y stars (para consistencia)
    const ratingPayload = {
      value: ratingValue, // ✅ Requerido: value is int && value >= 1 && value <= 5
      stars: ratingValue, // ✅ Incluido para consistencia
      userId: raterId, // ✅ Opcional según reglas, pero incluimos para consistencia
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      // ✅ RATING SCOPE ENFORCEMENT: Question ratings grant XP to the question author.
      //    This is the ONLY place where ratings grant XP directly.
      //    Answer ratings do NOT grant XP (they only affect trophies).
      // ✅ Loguear payload exacto antes de escribir
      console.log(`[rateQuestion] 📝 Iniciando transacción para rating en ${path}:`, {
        path,
        payload: {
          value: ratingValue,
          stars: ratingValue,
          userId: raterId,
          createdAt: "<serverTimestamp>",
          updatedAt: "<serverTimestamp>",
        },
      });

      // ✅ Leer TODOS los ratings de la pregunta ANTES de la transacción
      // Nota: No podemos usar getDocs() dentro de una transacción de Firestore
      // Leer la colección justo antes de la transacción minimiza la ventana de race condition
      // La transacción garantiza que las escrituras sean atómicas
      const ratingsSnap = await getDocs(ratingsRef);
      
      // Construir objeto ratingsByUserId desde todos los ratings existentes
      const ratingsByUserId: Record<string, number> = {};
      for (const ratingDoc of ratingsSnap.docs) {
        const ratingData = ratingDoc.data();
        const userId = ratingDoc.id;
        const value = Number(ratingData?.value);
        if (isValidStars(value)) {
          ratingsByUserId[userId] = value;
        }
      }

      // ✅ Agregar el nuevo rating (primera vez que este usuario califica)
      ratingsByUserId[raterId] = ratingValue;

      // Recalcular ratingAvg y ratingCount (solo se actualiza en primera calificación)
      const { ratingAvg, ratingCount } = this.computeRatingStats(ratingsByUserId);

      // ✅ Usar transacción para garantizar consistencia y evitar race conditions
      // CRITICAL: ALL reads MUST be executed BEFORE any writes
      const xpToAdd = getXpByStars(ratingValue);
      let authorId: string | null = null;
      
      await runTransaction(db, async (tx) => {
        // ============================================
        // PHASE 1: ALL READS FIRST (MANDATORY)
        // ============================================
        
        // 1. Read question document
        const questionSnap = await tx.get(questionRef);
        if (!questionSnap.exists()) {
          throw new ServiceError("questions/not-found", "Pregunta no encontrada");
        }

        const questionData = questionSnap.data();
        authorId = questionData?.authorId || null;
        
        if (!authorId) {
          throw new ServiceError("validation/invalid-argument", "No se pudo obtener el autor de la pregunta");
        }

        // 2. Read rating document (verify user has NOT rated before)
        // ✅ FIX 1: Enforce ONE-TIME rating - if exists, EXIT immediately
        const currentRatingSnap = await tx.get(ratingRef);
        if (currentRatingSnap.exists()) {
          console.log(`[rateQuestion] Rating bloqueado: usuario ya calificó esta pregunta (${path}) - ONE-TIME rating enforced`);
          return; // Exit without ANY changes - rating is immutable after creation
        }

        // 3. Validate: user is NOT the author
        if (authorId === raterId) {
          throw new ServiceError("validation/invalid-argument", "No puedes calificar tu propia pregunta");
        }

        // 4. Read user document (for XP grant)
        const userRef = doc(db, "users", authorId);
        const userSnap = await tx.get(userRef);
        
        // 5. Read publicProfile document (for XP grant)
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        const publicProfileSnap = await tx.get(publicProfileRef);
        
        console.log(`[rateQuestion] all reads completed`);

        // ============================================
        // PHASE 2: ALL WRITES (AFTER ALL READS)
        // ============================================
        
        // 1. Create rating document
        tx.set(ratingRef, ratingPayload);
        console.log(`[rateQuestion] rating created`);

        // 2. Update question document
        tx.update(questionRef, {
          ratingAvg,
          ratingCount,
          updatedAt: serverTimestamp(),
        });

        // 3. Grant XP (only on first rating, rater !== author)
        if (xpToAdd > 0) {
          // ✅ FIX 1: Sync XP between /users/{authorId} and /publicProfiles/{authorId}
          const userEmail = auth.currentUser?.email || "";
          const newXp = syncXpChangeWithSnapshots(
            tx,
            db,
            authorId,
            userSnap,
            publicProfileSnap,
            xpToAdd,
            userEmail
          );
          const newLevel = calculateLevel(newXp);
          const newRank = calculateRank(newLevel);
          
          console.log(`[rateQuestion] XP granted to author: ${xpToAdd} XP a usuario ${authorId} por rating de ${ratingValue} estrellas (nuevo XP: ${newXp}, nivel: ${newLevel}, rango: ${newRank})`);
        }
      });

      console.log(`[rateQuestion] ✓ Rating guardado exitosamente: ${path}, value=${ratingValue}`);
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      const errorMessage = safeErr(e);
      
      // ✅ Manejar errores específicos de ServiceError
      if (e instanceof ServiceError) {
        throw e;
      }

      console.error(`[rateQuestion] ❌ Error en ${path}:`, {
        errorCode,
        errorMessage,
        path,
        payload: ratingPayload,
      });
      
      if (errorCode === "permission-denied") {
        throw new ServiceError("permission-denied", "No tienes permisos para calificar esta pregunta");
      }
      throw new ServiceError("ratings/create-failed", `Error al calificar la pregunta: ${errorMessage}`);
    }

    // ✅ Obtener la pregunta actualizada para notificaciones y retorno
    const q = await this.getQuestionById(input.questionId);
    if (!q) throw new ServiceError("questions/not-found", "No se pudo recargar la pregunta después de calificar");

    // ✅ Recalculate and persist author's average rating including BOTH question and answer ratings
    // This must be done AFTER transaction to avoid read-after-write issues
    try {
      const authorId = q.authorId;
      if (authorId && authorId !== raterId) {
        // ✅ Calculate avgRating including both question and answer ratings
        const averageRating = await this.calculateAvgRatingIncludingAnswers(authorId);
        
        // ✅ Update users/{userId} FIRST (source of truth)
        const userRef = doc(db, "users", authorId);
        await updateDoc(userRef, {
          avgRating: averageRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          // If document doesn't exist, create it
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              uid: authorId,
              avgRating: averageRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });
        
        // ✅ Then update publicProfiles/{userId} as projection of users/{userId}
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        await updateDoc(publicProfileRef, {
          avgRating: averageRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          // If document doesn't exist, create it
          const existingSnap = await getDoc(publicProfileRef);
          if (!existingSnap.exists()) {
            await setDoc(publicProfileRef, {
              userId: authorId,
              uid: authorId,
              avgRating: averageRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });
        
        console.log(`[rateQuestion] ✓ Average rating updated for author ${authorId}: ${averageRating} (including question and answer ratings) - synced to users and publicProfiles`);
      }
    } catch (e: any) {
      // Best-effort: don't break rating flow if average calculation fails
      console.warn(`[rateQuestion] ⚠️ Error calculating average rating (best-effort): ${safeErr(e)}`);
    }

    // Notificaciones (secundario)
    try {
      await notificationsService.create(
        questionRatedNotification({
          userId: q.authorId,
          questionId: input.questionId,
          fromUserId: raterId,
          rating: ratingValue,
          ratingAvg: q.ratingAvg,
        })
      );
    } catch (e: any) {
      console.warn(`[rateQuestion] notif author fail: ${safeErr(e)}`);
    }

    // ✅ Notificaciones a followers (best-effort, no debe romper el flujo)
    userDataService
      .getQuestionFollowers(input.questionId)
      .then(async (followers) => {
        if (followers.length === 0) return; // ✅ No hay seguidores, no hacer nada

        await Promise.all(
          followers
            .filter((f) => f !== q.authorId && f !== raterId)
            .map((f) =>
              notificationsService.create(
                questionRatedNotification({
                  userId: f,
                  questionId: input.questionId,
                  fromUserId: raterId,
                  rating: ratingValue,
                  ratingAvg: q.ratingAvg,
                })
              ).catch((notifErr: any) => {
                // ✅ No loggear cada notificación fallida individualmente (spam)
                // Solo loggear si es crítico
                if (notifErr?.code !== "permission-denied") {
                  console.warn(`[rateQuestion] ⚠️ Error creando notificación para follower ${f}: ${notifErr?.code || "unknown"}`);
                }
              })
            )
        );
      })
      .catch((followersErr: any) => {
        // ✅ No romper el flujo si getQuestionFollowers falla
        const errorCode = followersErr?.code || "unknown";
        if (errorCode !== "permission-denied") {
          console.warn(`[rateQuestion] ⚠️ Error obteniendo followers (no bloquea): ${errorCode} - ${safeErr(followersErr)}`);
        }
      });

    return q;
  }

  async listQuestionsByAuthorId(authorId: string): Promise<Question[]> {
    requireDb();

    const ref = collection(db, FIRESTORE_PATHS.QUESTIONS);
    let snap;
    try {
      snap = await getDocs(query(ref, where("authorId", "==", authorId), orderBy("createdAt", "desc")));
    } catch (e: any) {
      console.warn(`[listQuestionsByAuthorId] orderBy fallback: ${safeErr(e)}`);
      snap = await getDocs(query(ref, where("authorId", "==", authorId)));
    }

    const out: Question[] = [];
    for (const d of snap.docs) {
      try {
        out.push(await this.firestoreQuestionToQuestion(d));
      } catch (e: any) {
        console.warn(`[listQuestionsByAuthorId] skip ${d.id}: ${safeErr(e)}`);
      }
    }

    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }

  async listAnswersByAuthorId(
    authorId: string
  ): Promise<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>> {
    requireDb();

    try {
      const cg = collectionGroup(db, "answers");
      const snap = await getDocs(query(cg, where("authorId", "==", authorId), orderBy("createdAt", "desc")));
      return snap.docs.map((d) => {
        const data = d.data();
        const parts = d.ref.path.split("/");
        const qid = parts[1];
        return {
          questionId: qid,
          answerId: d.id,
          content: data.content || "",
          createdAt: this.timestampToIso(data.createdAt),
        };
      });
    } catch (e: any) {
      console.warn(`[listAnswersByAuthorId] collectionGroup fallback: ${safeErr(e)}`);
    }

    const questionsRef = collection(db, FIRESTORE_PATHS.QUESTIONS);
    const questionsSnap = await getDocs(questionsRef);

    const all: Array<{ questionId: string; answerId: string; content: string; createdAt: string }> = [];

    for (const qd of questionsSnap.docs) {
      const qid = qd.id;
      const answersRef = collection(db, FIRESTORE_PATHS.answers(qid));
      try {
        const snap = await getDocs(query(answersRef, where("authorId", "==", authorId)));
        for (const ad of snap.docs) {
          const a = ad.data();
          all.push({
            questionId: qid,
            answerId: ad.id,
            content: a.content || "",
            createdAt: this.timestampToIso(a.createdAt),
          });
        }
      } catch (e: any) {
        console.warn(`[listAnswersByAuthorId] skip q=${qid}: ${safeErr(e)}`);
      }
    }

    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return all;
  }

  async syncQuestionsCount(userId: string): Promise<number> {
    requireDb();

    const questionsRef = collection(db, FIRESTORE_PATHS.QUESTIONS);
    const snap = await getDocs(query(questionsRef, where("authorId", "==", userId), where("status", "==", "active")));
    const realCount = snap.size;

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await updateDoc(userRef, { questionsCount: realCount, updatedAt: serverTimestamp() });
    } else {
      await setDoc(
        userRef,
        {
          questionsCount: realCount,
          answersCount: 0,
          savedCount: 0,
          followedCount: 0,
          level: 1,
          xp: 0,
          rank: "Novato",
          avgRating: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return realCount;
  }

  async syncAnswersCount(userId: string): Promise<number> {
    requireDb();

    try {
      const cg = collectionGroup(db, "answers");
      const snap = await getDocs(query(cg, where("authorId", "==", userId)));
      const count = snap.size;

      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) await updateDoc(userRef, { answersCount: count, updatedAt: serverTimestamp() });
      else
        await setDoc(userRef, { answersCount: count, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });

      return count;
    } catch {}

    const questionsRef = collection(db, FIRESTORE_PATHS.QUESTIONS);
    const questionsSnap = await getDocs(questionsRef);

    let count = 0;
    for (const qd of questionsSnap.docs) {
      try {
        const answersRef = collection(db, FIRESTORE_PATHS.answers(qd.id));
        const snap = await getDocs(query(answersRef, where("authorId", "==", userId)));
        count += snap.size;
      } catch {}
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) await updateDoc(userRef, { answersCount: count, updatedAt: serverTimestamp() });
    else await setDoc(userRef, { answersCount: count, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });

    return count;
  }

  async recalculateStats(userId: string): Promise<{ questionsCount: number; answersCount: number }> {
    const questionsCount = await this.syncQuestionsCount(userId);
    const answersCount = await this.syncAnswersCount(userId);
    return { questionsCount, answersCount };
  }

  async syncAuthorName(authorId: string, newName: string): Promise<void> {
    requireDb();

    try {
      const questionsRef = collection(db, FIRESTORE_PATHS.QUESTIONS);
      const qSnap = await getDocs(query(questionsRef, where("authorId", "==", authorId)));

      const batch = writeBatch(db);
      let count = 0;

      for (const d of qSnap.docs) {
        batch.update(d.ref, { authorName: newName });
        count++;
      }

      for (const d of qSnap.docs) {
        const qid = d.id;
        const answersRef = collection(db, FIRESTORE_PATHS.answers(qid));
        try {
          const aSnap = await getDocs(query(answersRef, where("authorId", "==", authorId)));
          for (const ad of aSnap.docs) {
            batch.update(ad.ref, { authorName: newName });
            count++;
          }
        } catch {}
      }

      if (count) await batch.commit();
    } catch (e: any) {
      throw new ServiceError("questions/sync-failed", `Error al sincronizar el nombre del autor: ${safeErr(e)}`);
    }
  }

  // ✅ Helper to calculate avgRating including BOTH question and answer ratings
  private async calculateAvgRatingIncludingAnswers(authorId: string, excludedQuestionId?: string, excludedAnswerId?: string): Promise<number> {
    try {
      // Get all questions by this author
      const authorQuestions = await this.listQuestionsByAuthorId(authorId);
      
      // Calculate ratings from questions
      let totalRatings = 0;
      let totalStars = 0;
      
      for (const question of authorQuestions) {
        // Exclude the question if specified
        if (excludedQuestionId && question.id === excludedQuestionId) continue;
        
        if (question.ratingCount > 0 && question.ratingAvg > 0) {
          totalRatings += question.ratingCount;
          totalStars += question.ratingAvg * question.ratingCount;
        }
      }
      
      // Get all answers by this author and include their ratings
      const authorAnswers = await this.listAnswersByAuthorId(authorId);
      
      // Fetch answer documents to get ratingAvg and ratingCount
      for (const answerInfo of authorAnswers) {
        // Exclude the answer if specified
        if (excludedAnswerId && answerInfo.answerId === excludedAnswerId) continue;
        
        try {
          const answerRef = doc(db, FIRESTORE_PATHS.answer(answerInfo.questionId, answerInfo.answerId));
          const answerSnap = await getDoc(answerRef);
          
          if (answerSnap.exists()) {
            const answerData = answerSnap.data();
            const ratingCount = Number(answerData?.ratingCount || 0);
            const ratingAvg = Number(answerData?.ratingAvg || 0);
            
            if (ratingCount > 0 && ratingAvg > 0) {
              totalRatings += ratingCount;
              totalStars += ratingAvg * ratingCount;
            }
          }
        } catch (e: any) {
          console.warn(`[calculateAvgRatingIncludingAnswers] ⚠️ Error leyendo respuesta ${answerInfo.answerId} (best-effort): ${safeErr(e)}`);
        }
      }
      
      return totalRatings > 0 ? Math.round((totalStars / totalRatings) * 10) / 10 : 0;
    } catch (e: any) {
      console.warn(`[calculateAvgRatingIncludingAnswers] Error calculando avgRating (best-effort): ${safeErr(e)}`);
      return 0;
    }
  }

  // ✅ DOMAIN FUNCTION: Delete question with all side effects
  // - Reverts XP from question and answer ratings
  // - Updates avgRating
  // - Decrements savedCount/followedCount for affected users
  // - Updates questionsCount and publicProfiles
  async deleteQuestionWithSideEffects(questionId: string, actor: User): Promise<void> {
    requireDb();
    const uid = requireAuthUid();

    const q = await this.getQuestionById(questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const isAdmin = actor?.role === "ADMIN";
    if (!isAdmin && q.authorId !== uid) {
      throw new ServiceError("validation/invalid-argument", "Solo el autor o administradores pueden eliminar preguntas");
    }

    const questionRef = doc(db, FIRESTORE_PATHS.QUESTIONS, questionId);
    const answersRef = collection(db, FIRESTORE_PATHS.answers(questionId));
    const answersSnap = await getDocs(answersRef);

    const authorId = q.authorId;
    const userRef = authorId ? doc(db, "users", authorId) : null;

    // ✅ Obtener lista de usuarios que guardaron/siguieron esta pregunta para actualizar sus contadores
    const savedUserIds: string[] = [];
    const followedUserIds: string[] = [];
    try {
      // Obtener usuarios que guardaron esta pregunta (el docId es el questionId)
      const savedQuestionsRef = collectionGroup(db, "savedQuestions");
      const savedSnap = await getDocs(savedQuestionsRef);
      for (const doc of savedSnap.docs) {
        if (doc.id === questionId) {
          // El userId está en la ruta: users/{userId}/savedQuestions/{questionId}
          const pathParts = doc.ref.path.split('/');
          const userIdIndex = pathParts.indexOf('users');
          if (userIdIndex >= 0 && userIdIndex < pathParts.length - 1) {
            const userId = pathParts[userIdIndex + 1];
            if (userId) savedUserIds.push(userId);
          }
        }
      }

      // Obtener usuarios que siguen esta pregunta (el docId es el questionId)
      const followedQuestionsRef = collectionGroup(db, "followedQuestions");
      const followedSnap = await getDocs(followedQuestionsRef);
      for (const doc of followedSnap.docs) {
        if (doc.id === questionId) {
          // El userId está en la ruta: users/{userId}/followedQuestions/{questionId}
          const pathParts = doc.ref.path.split('/');
          const userIdIndex = pathParts.indexOf('users');
          if (userIdIndex >= 0 && userIdIndex < pathParts.length - 1) {
            const userId = pathParts[userIdIndex + 1];
            if (userId) followedUserIds.push(userId);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[deleteQuestion] ⚠️ No se pudieron verificar saved/followed (best-effort): ${safeErr(e)}`);
    }

    // ✅ Calculate total XP granted by this question's ratings BEFORE transaction
    const ratingsRef = collection(db, "questions", questionId, "ratings");
    let totalXpToSubtract = 0;
    const questionRatings: Array<{ stars: number; raterId: string }> = [];
    try {
      const ratingsSnap = await getDocs(ratingsRef);
      for (const ratingDoc of ratingsSnap.docs) {
        const ratingData = ratingDoc.data();
        const stars = Number(ratingData?.value || ratingData?.stars || 0);
        if (isValidStars(stars)) {
          const raterId = ratingDoc.id;
          questionRatings.push({ stars, raterId });
          // Only count XP if rater is not the author (XP is only granted when rater !== author)
          if (raterId !== authorId) {
            const xpGranted = getXpByStars(stars);
            totalXpToSubtract += xpGranted;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[deleteQuestionWithSideEffects] ⚠️ No se pudieron leer ratings para calcular XP a revertir (best-effort): ${safeErr(e)}`);
    }

    // Calculate XP from all answer ratings before transaction
    const answerAuthorXpMap: Record<string, number> = {};
    for (const answerDoc of answersSnap.docs) {
      const answerData = answerDoc.data();
      const answerAuthorId = answerData?.authorId;
      if (!answerAuthorId) continue;

      const answerRatingsRef = collection(db, "questions", questionId, "answers", answerDoc.id, "ratings");
      try {
        const answerRatingsSnap = await getDocs(answerRatingsRef);
        for (const ratingDoc of answerRatingsSnap.docs) {
          const ratingData = ratingDoc.data();
          const stars = Number(ratingData?.value || ratingData?.stars || 0);
          if (isValidStars(stars)) {
            const raterId = ratingDoc.id;
            if (raterId !== answerAuthorId) {
              const xpGranted = getXpByStars(stars);
              answerAuthorXpMap[answerAuthorId] = (answerAuthorXpMap[answerAuthorId] || 0) + xpGranted;
            }
          }
        }
      } catch (e: any) {
        console.warn(`[deleteQuestion] ⚠️ No se pudieron leer ratings de respuesta ${answerDoc.id} (best-effort): ${safeErr(e)}`);
      }
    }

    await runTransaction(db, async (tx) => {
      // ============================================
      // PHASE 1: ALL READS FIRST (MANDATORY)
      // ============================================
      
      // Read question author's user and publicProfile documents
      const userSnap = userRef ? await tx.get(userRef) : null;
      const publicProfileRef = authorId ? doc(db, "publicProfiles", authorId) : null;
      const publicProfileSnap = publicProfileRef ? await tx.get(publicProfileRef) : null;

      // Read all answer authors' user and publicProfile documents
      const answerAuthorSnaps: Record<string, { userSnap: any; publicProfileSnap: any }> = {};
      for (const [answerAuthorId] of Object.entries(answerAuthorXpMap)) {
        if (answerAuthorId) {
          const answerUserRef = doc(db, "users", answerAuthorId);
          const answerPublicProfileRef = doc(db, "publicProfiles", answerAuthorId);
          answerAuthorSnaps[answerAuthorId] = {
            userSnap: await tx.get(answerUserRef),
            publicProfileSnap: await tx.get(answerPublicProfileRef),
          };
        }
      }

      // Read all saved users' documents
      const savedUserSnaps: Record<string, { userSnap: any; publicProfileSnap: any }> = {};
      for (const userId of savedUserIds) {
        if (userId) {
          const savedUserRef = doc(db, "users", userId);
          const savedPublicProfileRef = doc(db, "publicProfiles", userId);
          savedUserSnaps[userId] = {
            userSnap: await tx.get(savedUserRef),
            publicProfileSnap: await tx.get(savedPublicProfileRef),
          };
        }
      }

      // Read all followed users' documents
      const followedUserSnaps: Record<string, { userSnap: any; publicProfileSnap: any }> = {};
      for (const userId of followedUserIds) {
        if (userId) {
          const followedUserRef = doc(db, "users", userId);
          const followedPublicProfileRef = doc(db, "publicProfiles", userId);
          followedUserSnaps[userId] = {
            userSnap: await tx.get(followedUserRef),
            publicProfileSnap: await tx.get(followedPublicProfileRef),
          };
        }
      }

      // ✅ NOTE: avgRating calculation is moved OUTSIDE the transaction
      // to avoid read/write order violations. It will be recalculated after deletion completes.

      // ============================================
      // PHASE 2: ALL CALCULATIONS IN MEMORY
      // ============================================
      
      // Calculate new questionsCount for question author
      const newQuestionsCount = userSnap?.exists() 
        ? Math.max(0, (userSnap.data()?.questionsCount ?? 0) - 1)
        : 0;

      // Calculate new savedCount for all saved users
      const savedCountUpdates: Record<string, number> = {};
      for (const [userId, snaps] of Object.entries(savedUserSnaps)) {
        if (snaps.userSnap.exists()) {
          savedCountUpdates[userId] = Math.max(0, (snaps.userSnap.data()?.savedCount ?? 0) - 1);
        }
      }

      // Calculate new followedCount for all followed users
      const followedCountUpdates: Record<string, number> = {};
      for (const [userId, snaps] of Object.entries(followedUserSnaps)) {
        if (snaps.userSnap.exists()) {
          followedCountUpdates[userId] = Math.max(0, (snaps.userSnap.data()?.followedCount ?? 0) - 1);
        }
      }

      // ============================================
      // PHASE 3: ALL WRITES LAST (AFTER ALL READS)
      // ============================================

      // Delete all answers
      for (const a of answersSnap.docs) tx.delete(a.ref);
      
      // Delete question
      tx.delete(questionRef);

      // Subtract XP granted by this question's ratings
      if (authorId && totalXpToSubtract > 0 && userRef && publicProfileRef) {
        syncXpChangeWithSnapshots(
          tx,
          db,
          authorId,
          userSnap || { exists: () => false, data: () => ({}) },
          publicProfileSnap || { exists: () => false, data: () => ({}) },
          -totalXpToSubtract,
          ""
        );
        console.log(`[deleteQuestionWithSideEffects] XP revertido: ${totalXpToSubtract} XP restado de usuario ${authorId} por eliminación de pregunta ${questionId}`);
      } else if (authorId && totalXpToSubtract > 0) {
        console.warn(`[deleteQuestionWithSideEffects] ⚠️ No se pudo revertir XP (${totalXpToSubtract}) - userRef o publicProfileRef faltantes`);
      }

      // Subtract XP granted by all answer ratings
      for (const [answerAuthorId, xpToSubtract] of Object.entries(answerAuthorXpMap)) {
        if (xpToSubtract > 0 && answerAuthorSnaps[answerAuthorId]) {
          const snaps = answerAuthorSnaps[answerAuthorId];
          syncXpChangeWithSnapshots(
            tx,
            db,
            answerAuthorId,
            snaps.userSnap || { exists: () => false, data: () => ({}) },
            snaps.publicProfileSnap || { exists: () => false, data: () => ({}) },
            -xpToSubtract,
            ""
          );
          console.log(`[deleteQuestionWithSideEffects] XP revertido: ${xpToSubtract} XP restado de usuario ${answerAuthorId} por eliminación de respuestas en pregunta ${questionId}`);
        }
      }

      // Update questionsCount for question author (users and publicProfiles)
      if (userRef && userSnap?.exists()) {
        tx.update(userRef, {
          questionsCount: newQuestionsCount,
          updatedAt: serverTimestamp(),
        });
        
        // Update also in publicProfiles
        if (publicProfileRef && publicProfileSnap?.exists()) {
          tx.update(publicProfileRef, {
            questionsCount: newQuestionsCount,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Decrement savedCount for all users who saved this question
      for (const [userId, newSavedCount] of Object.entries(savedCountUpdates)) {
        const savedUserRef = doc(db, "users", userId);
        const savedPublicProfileRef = doc(db, "publicProfiles", userId);
        const snaps = savedUserSnaps[userId];
        
        if (snaps?.userSnap.exists()) {
          tx.update(savedUserRef, {
            savedCount: newSavedCount,
            updatedAt: serverTimestamp(),
          });
          
          // Update also in publicProfiles if exists
          if (snaps.publicProfileSnap.exists()) {
            tx.update(savedPublicProfileRef, {
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // Decrement followedCount for all users who follow this question
      for (const [userId, newFollowedCount] of Object.entries(followedCountUpdates)) {
        const followedUserRef = doc(db, "users", userId);
        const followedPublicProfileRef = doc(db, "publicProfiles", userId);
        const snaps = followedUserSnaps[userId];
        
        if (snaps?.userSnap.exists()) {
          tx.update(followedUserRef, {
            followedCount: newFollowedCount,
            updatedAt: serverTimestamp(),
          });
          
          // Update also in publicProfiles if exists
          if (snaps.publicProfileSnap.exists()) {
            tx.update(followedPublicProfileRef, {
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // ✅ NOTE: avgRating update is moved OUTSIDE the transaction
      // to avoid read/write order violations
    }).catch((e: any) => {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para eliminar esta pregunta");
      throw new ServiceError("questions/delete-failed", `Error al eliminar la pregunta: ${safeErr(e)}`);
    });

    // ✅ Recalculate avgRating AFTER transaction completes (best-effort, outside transaction)
    // This includes BOTH question and answer ratings, excluding the deleted question
    if (authorId) {
      try {
        const newAvgRating = await this.calculateAvgRatingIncludingAnswers(authorId, questionId);
        const userRef = doc(db, "users", authorId);
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        
        // Update in users/{userId}
        await updateDoc(userRef, {
          avgRating: newAvgRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              avgRating: newAvgRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });

        // Update in publicProfiles/{userId}
        await updateDoc(publicProfileRef, {
          avgRating: newAvgRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          const existingSnap = await getDoc(publicProfileRef);
          if (!existingSnap.exists()) {
            await setDoc(publicProfileRef, {
              uid: authorId,
              userId: authorId,
              avgRating: newAvgRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });

        console.log(`[deleteQuestionWithSideEffects] ✓ avgRating actualizado fuera de transacción para autor ${authorId}: ${newAvgRating} (pregunta ${questionId} excluida, incluye ratings de preguntas y respuestas)`);
      } catch (e: any) {
        console.warn(`[deleteQuestionWithSideEffects] ⚠️ Error actualizando avgRating fuera de transacción (best-effort): ${safeErr(e)}`);
      }
    }
  }

  // ✅ DOMAIN FUNCTION: Delete answer with all side effects
  // - Reverts XP from answer ratings
  // - Updates answersCount and publicProfiles
  async deleteAnswerWithSideEffects(questionId: string, answerId: string, actor: User): Promise<void> {
    requireDb();
    const uid = requireAuthUid();

    const q = await this.getQuestionById(questionId);
    if (!q) throw new ServiceError("questions/not-found", "Pregunta no encontrada");

    const answer = q.answers.find((a) => a.id === answerId);
    if (!answer) throw new ServiceError("questions/not-found", "Respuesta no encontrada");

    const isAdmin = actor?.role === "ADMIN";
    if (!isAdmin && answer.authorId !== uid) {
      throw new ServiceError("validation/invalid-argument", "Solo el autor o administradores pueden eliminar respuestas");
    }

    const answerRef = doc(db, FIRESTORE_PATHS.answer(questionId, answerId));
    const authorId = answer.authorId;
    const userRef = authorId ? doc(db, "users", authorId) : null;

    // Calculate total XP granted by this answer's ratings
    const ratingsRef = collection(db, "questions", questionId, "answers", answerId, "ratings");
    let totalXpToSubtract = 0;
    try {
      const ratingsSnap = await getDocs(ratingsRef);
      for (const ratingDoc of ratingsSnap.docs) {
        const ratingData = ratingDoc.data();
        const stars = Number(ratingData?.value || ratingData?.stars || 0);
        if (isValidStars(stars)) {
          const raterId = ratingDoc.id;
          if (raterId !== authorId) {
            const xpGranted = getXpByStars(stars);
            totalXpToSubtract += xpGranted;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[deleteAnswer] ⚠️ No se pudieron leer ratings para calcular XP a revertir (best-effort): ${safeErr(e)}`);
    }

    await runTransaction(db, async (tx) => {
      // ============================================
      // PHASE 1: ALL READS FIRST (MANDATORY)
      // ============================================
      
      const userSnap = userRef ? await tx.get(userRef) : null;
      const publicProfileRef = authorId ? doc(db, "publicProfiles", authorId) : null;
      const publicProfileSnap = publicProfileRef ? await tx.get(publicProfileRef) : null;

      // ============================================
      // PHASE 2: ALL CALCULATIONS IN MEMORY
      // ============================================
      
      // Calculate new XP, level, rank (if XP needs to be reverted)
      let newXp = 0;
      let newLevel = 1;
      let newRank = "Novato";
      if (authorId && totalXpToSubtract > 0 && userSnap?.exists()) {
        const currentXp = Number(userSnap.data()?.xp || 0);
        newXp = Math.max(0, currentXp - totalXpToSubtract);
        newLevel = calculateLevel(newXp);
        newRank = calculateRank(newLevel);
      } else if (authorId && userSnap?.exists()) {
        // Keep existing values if no XP to subtract
        newXp = Number(userSnap.data()?.xp || 0);
        newLevel = Number(userSnap.data()?.level || 1);
        newRank = userSnap.data()?.rank || "Novato";
      }

      // Calculate new answersCount
      const newAnswersCount = userSnap?.exists() 
        ? Math.max(0, (userSnap.data()?.answersCount ?? 0) - 1)
        : 0;

      // ============================================
      // PHASE 3: ALL WRITES LAST (AFTER ALL READS)
      // ============================================

      // Delete answer
      tx.delete(answerRef);

      // ✅ Update users/{userId} with ALL changes in a SINGLE update (XP, level, rank, answersCount)
      // This prevents failed-precondition errors from multiple updates to the same document
      if (userRef && userSnap?.exists()) {
        const updateData: any = {
          answersCount: newAnswersCount,
          updatedAt: serverTimestamp(),
        };
        
        // Include XP, level, rank if XP was reverted
        if (authorId && totalXpToSubtract > 0) {
          updateData.xp = newXp;
          updateData.level = newLevel;
          updateData.rank = newRank;
        }
        
        tx.update(userRef, updateData);
        
        if (authorId && totalXpToSubtract > 0) {
          console.log(`[deleteAnswerWithSideEffects] XP revertido: ${totalXpToSubtract} XP restado de usuario ${authorId} por eliminación de respuesta ${answerId}`);
        }
      } else if (authorId && totalXpToSubtract > 0) {
        console.warn(`[deleteAnswerWithSideEffects] ⚠️ No se pudo revertir XP (${totalXpToSubtract}) - userRef o userSnap faltantes`);
      }
      
      // ✅ Update publicProfiles/{userId} with ALL changes in a SINGLE update (XP, level, rank, answersCount)
      // This prevents failed-precondition errors from multiple updates to the same document
      if (publicProfileRef && publicProfileSnap?.exists()) {
        const updateData: any = {
          answersCount: newAnswersCount,
          updatedAt: serverTimestamp(),
        };
        
        // Include XP, level, rank if XP was reverted
        if (authorId && totalXpToSubtract > 0) {
          updateData.xp = newXp;
          updateData.level = newLevel;
          updateData.rank = newRank;
        }
        
        tx.update(publicProfileRef, updateData);
      }
    }).catch((e: any) => {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para eliminar esta respuesta");
      throw new ServiceError("answers/delete-failed", `Error al eliminar la respuesta: ${safeErr(e)}`);
    });

    // ✅ Recalculate avgRating AFTER transaction completes (best-effort, outside transaction)
    // This includes BOTH question and answer ratings, excluding the deleted answer
    if (authorId) {
      try {
        const newAvgRating = await this.calculateAvgRatingIncludingAnswers(authorId, undefined, answerId);
        const userRef = doc(db, "users", authorId);
        const publicProfileRef = doc(db, "publicProfiles", authorId);
        
        // Update in users/{userId}
        await updateDoc(userRef, {
          avgRating: newAvgRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              avgRating: newAvgRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });

        // Update in publicProfiles/{userId}
        await updateDoc(publicProfileRef, {
          avgRating: newAvgRating,
          updatedAt: serverTimestamp(),
        }).catch(async (e: any) => {
          const existingSnap = await getDoc(publicProfileRef);
          if (!existingSnap.exists()) {
            await setDoc(publicProfileRef, {
              uid: authorId,
              userId: authorId,
              avgRating: newAvgRating,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            throw e;
          }
        });

        console.log(`[deleteAnswerWithSideEffects] ✓ avgRating actualizado fuera de transacción para autor ${authorId}: ${newAvgRating} (respuesta ${answerId} excluida)`);
      } catch (e: any) {
        console.warn(`[deleteAnswerWithSideEffects] ⚠️ Error actualizando avgRating fuera de transacción (best-effort): ${safeErr(e)}`);
      }
    }

    const qRef = doc(db, FIRESTORE_PATHS.QUESTIONS, questionId);
    updateDoc(qRef, { answersCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
  }

  // Legacy alias for backward compatibility
  async deleteQuestion(questionId: string, actor: User): Promise<void> {
    return this.deleteQuestionWithSideEffects(questionId, actor);
  }

  // Legacy alias for backward compatibility
  async deleteAnswer(questionId: string, answerId: string, actor: User): Promise<void> {
    return this.deleteAnswerWithSideEffects(questionId, answerId, actor);
  }

  async addReply(input: { questionId: string; answerId: string; content: string }, author: User): Promise<Reply> {
    requireDb();
    const uid = requireAuthUid();

    const content = input.content.trim();
    if (content.length < 2) throw new ServiceError("validation/invalid-argument", "La respuesta es muy corta");

    let authorName = (author?.name || "").trim() || "Usuario";
    try {
      const u = await getDoc(doc(db, "users", uid));
      if (u.exists()) {
        const ud = u.data();
        authorName = (ud?.name || ud?.displayName || authorName).trim() || authorName;
      }
    } catch {}

    const repliesRef = collection(db, "questions", input.questionId, "answers", input.answerId, "replies");
    const replyRef = doc(repliesRef);

    const payload = {
      questionId: input.questionId,
      answerId: input.answerId,
      content,
      authorId: uid,
      authorName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(replyRef, payload);
    } catch (e: any) {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para crear replies en esta respuesta");
      throw new ServiceError("replies/create-failed", `Error al crear el reply: ${safeErr(e)}`);
    }

    try {
      const replies = await this.listReplies(input.questionId, input.answerId);
      const r = replies.find((x) => x.id === replyRef.id);
      if (r) return r;
    } catch {}

    const now = nowIso();
    return {
      id: replyRef.id,
      questionId: input.questionId,
      answerId: input.answerId,
      content,
      authorId: uid,
      authorName,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listReplies(questionId: string, answerId: string): Promise<Reply[]> {
    requireDb();

    const replies: Reply[] = [];
    const ref = collection(db, "questions", questionId, "answers", answerId, "replies");

    let snap;
    try {
      snap = await getDocs(query(ref, orderBy("createdAt", "asc")));
    } catch (e: any) {
      console.warn(`[listReplies] orderBy fallback: ${safeErr(e)}`);
      snap = await getDocs(ref);
    }

    for (const d of snap.docs) {
      const r = d.data();
      replies.push({
        id: d.id,
        questionId: r.questionId || questionId,
        answerId: r.answerId || answerId,
        content: r.content || "",
        authorId: r.authorId || "",
        authorName: r.authorName || "Usuario",
        createdAt: this.timestampToIso(r.createdAt),
        updatedAt: this.timestampToIso(r.updatedAt),
      });
    }

    replies.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return replies;
  }

  async deleteReply(questionId: string, answerId: string, replyId: string, actor: User): Promise<void> {
    requireDb();
    const uid = requireAuthUid();

    const ref = doc(db, "questions", questionId, "answers", answerId, "replies", replyId);
    const snap = await getDoc(ref);

    if (!snap.exists()) throw new ServiceError("questions/not-found", "Reply no encontrado");

    const data = snap.data();
    const isAdmin = actor?.role === "ADMIN";
    if (!isAdmin && data?.authorId !== uid) {
      throw new ServiceError("validation/invalid-argument", "Solo el autor o un administrador puede borrar este reply");
    }

    try {
      await deleteDoc(ref);
    } catch (e: any) {
      if (e?.code === "permission-denied") throw new ServiceError("permission-denied", "No tienes permisos para eliminar este reply");
      throw new ServiceError("replies/delete-failed", `Error al eliminar el reply: ${safeErr(e)}`);
    }
  }

  reset(): void {
    // no-op
  }
}
