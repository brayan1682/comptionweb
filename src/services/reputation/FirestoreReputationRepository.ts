import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import type { UserReputation } from "../../domain/types";
import { nowIso } from "../utils";
import { calculateLevel, calculateRank } from "./reputationUtils";
import type { ReputationRepository } from "./ReputationRepository";
import { db, auth } from "../../firebase/firebase";
import { notificationsService } from "../notifications/notificationsService";
import { levelUpNotification, rankUpNotification } from "../notifications/factories";

export class FirestoreReputationRepository implements ReputationRepository {
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) return timestamp.toDate().toISOString();
    if (typeof timestamp === "string") return timestamp;
    return new Date().toISOString();
  }

  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  async getByUserId(userId: string): Promise<UserReputation | null> {
    const authUid = auth.currentUser?.uid ?? null;

    try {
      // ✅ Unificar a 'reputations' según reglas
      const repDoc = await getDoc(doc(db, "reputations", userId));
      if (!repDoc.exists()) {
        const now = nowIso();
        const initialRep: UserReputation = {
          userId,
          xp: 0,
          level: 1,
          rank: "Novato",
          trophiesCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        if (authUid && authUid === userId) {
          try {
            // ✅ Unificar a 'reputations' según reglas
            await setDoc(doc(db, "reputations", userId), {
              userId: initialRep.userId,
              xp: initialRep.xp,
              level: initialRep.level,
              rank: initialRep.rank,
              trophiesCount: initialRep.trophiesCount,
              createdAt: this.isoToTimestamp(now),
              updatedAt: this.isoToTimestamp(now),
            });
          } catch (error: any) {
            const errorCode = error?.code || "unknown";
            console.warn(`[getByUserId] ⚠️ No se pudo crear documento de reputación (reputations/${userId}): ${errorCode} - ${error.message || error}`);
          }
        }
        return initialRep;
      }

      const data = repDoc.data();
      return {
        userId: data.userId,
        xp: data.xp || 0,
        level: data.level || 1,
        rank: data.rank || "Novato",
        trophiesCount: data.trophiesCount || 0,
        createdAt: this.timestampToIso(data.createdAt),
        updatedAt: this.timestampToIso(data.updatedAt),
      };
    } catch (error: any) {
      const errorCode = error?.code || "unknown";
      // ✅ Solo loggear si no es permission-denied esperado (cuando no hay auth o no es el dueño)
      if (errorCode !== "permission-denied") {
        console.warn(`[getByUserId] ⚠️ Error leyendo reputación (reputations/${userId}): ${errorCode} - ${error?.message || error}`);
      }
      // ✅ Fallback tolerante: retornar defaults sin romper UI
      const now = nowIso();
      return {
        userId,
        xp: 0,
        level: 1,
        rank: "Novato",
        trophiesCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  async addXp(userId: string, xpAmount: number): Promise<UserReputation> {
    const authUid = auth.currentUser?.uid;
    if (!authUid) throw new Error("No autenticado");

    if (userId !== authUid) {
      console.warn(`[addXp] Intento de sumar XP a otro usuario (${userId}) desde el cliente. Se omite por seguridad.`);
      const existing = await this.getByUserId(userId);
      return (
        existing ?? {
          userId,
          xp: 0,
          level: 1,
          rank: "Novato",
          trophiesCount: 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
      );
    }

    // ✅ Unificar a 'reputations' según reglas
    const repRef = doc(db, "reputations", userId);
    const repDoc = await getDoc(repRef);

    let currentXp = 0;
    let oldLevel = 1;
    let oldRank = "Novato";
    if (repDoc.exists()) {
      const data = repDoc.data();
      currentXp = data.xp || 0;
      oldLevel = data.level || 1;
      oldRank = data.rank || "Novato";
    }

    const newXp = currentXp + xpAmount;
    const newLevel = calculateLevel(newXp);
    const newRank = calculateRank(newLevel);

    const now = nowIso();
    if (repDoc.exists()) {
      await updateDoc(repRef, {
        xp: newXp,
        level: newLevel,
        rank: newRank,
        updatedAt: this.isoToTimestamp(now),
      });
    } else {
      await setDoc(repRef, {
        userId,
        xp: newXp,
        level: newLevel,
        rank: newRank,
        trophiesCount: 0,
        createdAt: this.isoToTimestamp(now),
        updatedAt: this.isoToTimestamp(now),
      });
    }

    // Best-effort sync a users/{uid} solo del propio usuario
    if (userId === authUid) {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        try {
          await updateDoc(userRef, {
            xp: newXp,
            level: newLevel,
            rank: newRank,
            updatedAt: now,
          });
        } catch (error: any) {
          console.warn("[addXp] No se pudo actualizar users/{uid} (puede ser por permisos):", error.message);
        }
      }
    }

    if (userId === authUid) {
      if (newLevel > oldLevel) {
        try {
          await notificationsService.create(levelUpNotification({ userId, level: newLevel, rank: newRank }));
        } catch (error: any) {
          console.warn("[addXp] No se pudo crear notificación de level-up:", error.message);
        }
      }
      if (newRank !== oldRank) {
        try {
          await notificationsService.create(rankUpNotification({ userId, level: newLevel, rank: newRank }));
        } catch (error: any) {
          console.warn("[addXp] No se pudo crear notificación de rank-up:", error.message);
        }
      }
    }

    return (await this.getByUserId(userId)) as UserReputation;
  }

  async setTrophiesCount(userId: string, count: number): Promise<UserReputation> {
    // ✅ Unificar a 'reputations' según reglas
    const repRef = doc(db, "reputations", userId);
    const repDoc = await getDoc(repRef);

    const now = nowIso();
    if (repDoc.exists()) {
      await updateDoc(repRef, {
        trophiesCount: count,
        updatedAt: this.isoToTimestamp(now),
      });
    } else {
      const rep = await this.getByUserId(userId);
      await setDoc(repRef, {
        userId,
        xp: rep?.xp || 0,
        level: rep?.level || 1,
        rank: rep?.rank || "Novato",
        trophiesCount: count,
        createdAt: this.isoToTimestamp(rep?.createdAt || now),
        updatedAt: this.isoToTimestamp(now),
      });
    }

    return (await this.getByUserId(userId)) as UserReputation;
  }

  reset(): void {}
}
