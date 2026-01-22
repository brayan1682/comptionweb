import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  runTransaction,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { nowIso } from "../utils";
import type { FollowedQuestion, SavedQuestion, UserDataRepository } from "./UserDataRepository";
import { db, auth } from "../../firebase/firebase";

export class FirestoreUserDataRepository implements UserDataRepository {
  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (typeof timestamp === "string") {
      return timestamp;
    }
    return new Date().toISOString();
  }

  // ✅ Toggle: Guardar pregunta en users/{userId}/savedQuestions/{questionId}
  async saveQuestion(userId: string, questionId: string): Promise<SavedQuestion> {
    const savedRef = doc(db, "users", userId, "savedQuestions", questionId);
    
    // Verificar si ya existe
    const existingDoc = await getDoc(savedRef);
    if (existingDoc.exists()) {
      // Ya está guardado, retornar sin hacer nada
      const data = existingDoc.data();
      return {
        userId,
        questionId,
        savedAt: this.timestampToIso(data.savedAt),
      };
    }
    
    const saved: SavedQuestion = {
      userId,
      questionId,
      savedAt: nowIso(),
    };
    
    // ✅ FIX: Reorganizar transacción: PRIMERO todos los reads, LUEGO todos los writes
    await runTransaction(db, async (transaction) => {
      // ✅ PASO 1: TODOS LOS READS PRIMERO
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);
      
      // ✅ PASO 2: TODOS LOS WRITES DESPUÉS
      // Crear el documento savedQuestion
      transaction.set(savedRef, {
        ...saved,
        savedAt: this.isoToTimestamp(saved.savedAt),
      });
      
      // Incrementar contador en users/{userId}
      if (userDoc.exists()) {
        transaction.update(userRef, {
          savedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Si el usuario no existe, crear con valores iniciales
        transaction.set(userRef, {
          savedCount: 1,
          followedCount: 0,
          questionsCount: 0,
          answersCount: 0,
          level: 1,
          xp: 0,
          rank: "Novato",
          avgRating: 0,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    });
    
    return saved;
  }

  // ✅ Toggle: Dejar de guardar pregunta
  async unsaveQuestion(userId: string, questionId: string): Promise<void> {
    const savedRef = doc(db, "users", userId, "savedQuestions", questionId);
    const savedDoc = await getDoc(savedRef);
    
    if (!savedDoc.exists()) {
      // Ya no está guardado, no hacer nada
      return;
    }
    
    // ✅ FIX: Reorganizar transacción: PRIMERO todos los reads, LUEGO todos los writes
    await runTransaction(db, async (transaction) => {
      // ✅ PASO 1: TODOS LOS READS PRIMERO
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);
      
      // ✅ PASO 2: TODOS LOS WRITES DESPUÉS
      // Borrar el documento savedQuestion
      transaction.delete(savedRef);
      
      // Decrementar contador en users/{userId}
      if (userDoc.exists()) {
        const userData = userDoc.data();
        transaction.update(userRef, {
          savedCount: Math.max(0, (userData.savedCount ?? 0) - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  // ✅ Leer preguntas guardadas desde users/{userId}/savedQuestions
  async getSavedQuestions(userId: string): Promise<string[]> {
    const savedRef = collection(db, "users", userId, "savedQuestions");
    const snapshot = await getDocs(savedRef);
    
    return snapshot.docs.map((doc) => doc.id); // El docId es el questionId
  }

  // ✅ Verificar si pregunta está guardada
  async isQuestionSaved(userId: string, questionId: string): Promise<boolean> {
    const savedRef = doc(db, "users", userId, "savedQuestions", questionId);
    const savedDoc = await getDoc(savedRef);
    return savedDoc.exists();
  }

  // ✅ Toggle: Seguir pregunta en users/{userId}/followedQuestions/{questionId}
  async followQuestion(userId: string, questionId: string): Promise<FollowedQuestion> {
    const followedRef = doc(db, "users", userId, "followedQuestions", questionId);
    
    // Verificar si ya existe
    const existingDoc = await getDoc(followedRef);
    if (existingDoc.exists()) {
      // Ya está siguiendo, retornar sin hacer nada
      const data = existingDoc.data();
      return {
        userId,
        questionId,
        followedAt: this.timestampToIso(data.followedAt),
      };
    }
    
    const followed: FollowedQuestion = {
      userId,
      questionId,
      followedAt: nowIso(),
    };
    
    // ✅ FIX: Reorganizar transacción: PRIMERO todos los reads, LUEGO todos los writes
    await runTransaction(db, async (transaction) => {
      // ✅ PASO 1: TODOS LOS READS PRIMERO
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);
      
      // ✅ PASO 2: TODOS LOS WRITES DESPUÉS
      // Crear el documento followedQuestion con campos requeridos por reglas
      transaction.set(followedRef, {
        userId: userId, // ✅ Requerido por reglas
        questionId: questionId, // ✅ Requerido por reglas
        createdAt: this.isoToTimestamp(followed.followedAt), // ✅ Requerido por reglas
      });
      
      // Incrementar contador en users/{userId}
      if (userDoc.exists()) {
        transaction.update(userRef, {
          followedCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Si el usuario no existe, crear con valores iniciales
        transaction.set(userRef, {
          savedCount: 0,
          followedCount: 1,
          questionsCount: 0,
          answersCount: 0,
          level: 1,
          xp: 0,
          rank: "Novato",
          avgRating: 0,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    });
    
    return followed;
  }

  // ✅ Toggle: Dejar de seguir pregunta
  async unfollowQuestion(userId: string, questionId: string): Promise<void> {
    const followedRef = doc(db, "users", userId, "followedQuestions", questionId);
    const followedDoc = await getDoc(followedRef);
    
    if (!followedDoc.exists()) {
      // Ya no está siguiendo, no hacer nada
      return;
    }
    
    // ✅ FIX: Reorganizar transacción: PRIMERO todos los reads, LUEGO todos los writes
    await runTransaction(db, async (transaction) => {
      // ✅ PASO 1: TODOS LOS READS PRIMERO
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);
      
      // ✅ PASO 2: TODOS LOS WRITES DESPUÉS
      // Borrar el documento followedQuestion
      transaction.delete(followedRef);
      
      // Decrementar contador en users/{userId}
      if (userDoc.exists()) {
        const userData = userDoc.data();
        transaction.update(userRef, {
          followedCount: Math.max(0, (userData.followedCount ?? 0) - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  // ✅ Leer preguntas seguidas desde users/{userId}/followedQuestions
  async getFollowedQuestions(userId: string): Promise<string[]> {
    const followedRef = collection(db, "users", userId, "followedQuestions");
    const snapshot = await getDocs(followedRef);
    
    return snapshot.docs.map((doc) => doc.id); // El docId es el questionId
  }

  // ✅ Obtener seguidores de una pregunta usando collectionGroup("followedQuestions")
  // Requiere auth según reglas: /users/*/followedQuestions/* permite read a usuarios autenticados
  async getQuestionFollowers(questionId: string): Promise<string[]> {
    // ✅ Si no hay auth, retornar [] (las reglas requieren auth para collectionGroup)
    if (!auth.currentUser) {
      return []; // ✅ No loggear - es esperado cuando no hay auth
    }

    const followers: string[] = [];
    const path = `collectionGroup("followedQuestions") where docId == ${questionId}`;
    
    try {
      const cg = collectionGroup(db, "followedQuestions");
      const snapshot = await getDocs(cg);
      
      // ✅ El docId es el questionId, filtrar por docId y extraer userId del path
      // Path: users/{userId}/followedQuestions/{questionId}
      snapshot.docs.forEach((doc) => {
        // Si el docId coincide con questionId, extraer userId del path
        if (doc.id === questionId) {
          const pathParts = doc.ref.path.split("/");
          const userIdIndex = pathParts.indexOf("users");
          if (userIdIndex >= 0 && userIdIndex + 1 < pathParts.length) {
            const userId = pathParts[userIdIndex + 1];
            if (userId && !followers.includes(userId)) {
              followers.push(userId);
            }
          }
        }
      });
      
      // ✅ Solo loggear si hay seguidores o si es necesario para debugging
      if (followers.length > 0) {
        console.log(`[getQuestionFollowers] ✓ Encontrados ${followers.length} seguidores para pregunta ${questionId}`);
      }
    } catch (error: any) {
      const errorCode = error?.code || "unknown";
      const errorMessage = error?.message || String(error);
      // ✅ Solo loggear warning si es un error inesperado (no permission-denied esperado)
      if (errorCode !== "permission-denied") {
        console.warn(`[getQuestionFollowers] ⚠️ Error obteniendo seguidores (${path}): ${errorCode} - ${errorMessage}`);
      }
      // ✅ Retornar array vacío en caso de error (best-effort, no rompe flujo)
    }
    
    return followers;
  }

  // ✅ Verificar si pregunta está siendo seguida
  async isQuestionFollowed(userId: string, questionId: string): Promise<boolean> {
    const followedRef = doc(db, "users", userId, "followedQuestions", questionId);
    const followedDoc = await getDoc(followedRef);
    return followedDoc.exists();
  }

  reset(): void {
    // No hay nada que resetear en Firestore (esto es para testing)
  }
}
