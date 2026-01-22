import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase/firebase";
import type { PublicProfile, PublicProfilesRepository } from "./PublicProfilesRepository";

export class FirestorePublicProfilesRepository implements PublicProfilesRepository {
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) return timestamp.toDate().toISOString();
    if (typeof timestamp === "string") return timestamp;
    return new Date().toISOString();
  }

  async getByUserId(userId: string): Promise<PublicProfile | null> {
    if (!db) throw new Error("Firebase db no está inicializado");
    if (!userId || typeof userId !== "string") return null;

    try {
      const profileRef = doc(db, "publicProfiles", userId);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) return null;

      const data = profileSnap.data();
      return {
        uid: data.uid || userId,
        displayName: data.displayName || "Usuario",
        photoURL: data.photoURL || undefined,
        level: Number(data.level || 1),
        rank: data.rank || "Novato",
        xp: Number(data.xp || 0),
        trophiesCount: Number(data.trophiesCount || 0), // ✅ NUEVO
        questionsCount: Number(data.questionsCount || 0),
        answersCount: Number(data.answersCount || 0),
        avgRating: Number(data.avgRating || 0),
        createdAt: this.timestampToIso(data.createdAt),
        updatedAt: this.timestampToIso(data.updatedAt),
      } as any;
    } catch (error: any) {
      console.warn(`[getByUserId] Error leyendo perfil público ${userId}: ${error.message || error.code || error}`);
      return null;
    }
  }

  async syncFromUser(
    userId: string,
    userData: {
      displayName: string;
      photoURL?: string;
      level: number;
      rank: string;
      xp: number;
      trophiesCount?: number; // ✅ NUEVO opcional
      questionsCount: number;
      answersCount: number;
      avgRating: number;
    }
  ): Promise<void> {
    if (!db) {
      console.warn(`[syncFromUser] ⚠️ Firebase db no está inicializado para ${userId}`);
      return; // ✅ No bloquear login
    }
    if (!auth.currentUser?.uid || auth.currentUser.uid !== userId) {
      console.warn(`[syncFromUser] ⚠️ Intento de sincronizar perfil de otro usuario: ${userId}`);
      return; // ✅ No bloquear login
    }

    try {
      const profileRef = doc(db, "publicProfiles", userId);
      const existing = await getDoc(profileRef);

      // ✅ Solo campos permitidos por reglas (acepta uid o userId, pero usamos uid consistentemente)
      // Campos permitidos: uid, userId, displayName, photoURL, level, rank, xp, questionsCount, answersCount, avgRating, trophiesCount, bestAnswersCount, createdAt, updatedAt, lastActiveAt
      const profileData: Record<string, any> = {
        uid: userId, // ✅ Requerido: debe coincidir con docId (usamos uid consistentemente)
        displayName: userData.displayName || "Usuario",
        photoURL: userData.photoURL || null,
        level: Number(userData.level || 1),
        rank: userData.rank || "Novato",
        xp: Number(userData.xp || 0),
        questionsCount: Number(userData.questionsCount || 0),
        answersCount: Number(userData.answersCount || 0),
        avgRating: Number(userData.avgRating || 0),
        trophiesCount: Number(userData.trophiesCount || 0),
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
        // ✅ NO incluir campos no permitidos como isAdmin, role, etc.
      };

      await setDoc(profileRef, profileData, { merge: true });
      console.log(`[syncFromUser] ✓ Perfil público sincronizado para ${userId}`);
    } catch (error: any) {
      const errorCode = error?.code || "unknown";
      const errorMessage = error?.message || String(error);
      // ✅ Solo loggear warning, NO bloquear login
      console.warn(`[syncFromUser] ⚠️ No se pudo sincronizar perfil público para ${userId} (no bloquea login): ${errorCode} - ${errorMessage}`);
      // ✅ NO lanzar error - esto es best-effort y no debe bloquear el flujo de autenticación
    }
  }
}


