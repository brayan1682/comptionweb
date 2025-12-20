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
import { db } from "../../firebase/firebase";

export class FirestoreReputationRepository implements ReputationRepository {
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (typeof timestamp === "string") {
      return timestamp;
    }
    return new Date().toISOString();
  }

  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  async getByUserId(userId: string): Promise<UserReputation | null> {
    const repDoc = await getDoc(doc(db, "reputation", userId));
    if (!repDoc.exists()) {
      // Si no existe, crear uno inicial
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
      await setDoc(doc(db, "reputation", userId), {
        ...initialRep,
        createdAt: this.isoToTimestamp(now),
        updatedAt: this.isoToTimestamp(now),
      });
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
  }

  async addXp(userId: string, xpAmount: number): Promise<UserReputation> {
    const repRef = doc(db, "reputation", userId);
    const repDoc = await getDoc(repRef);
    
    let currentXp = 0;
    if (repDoc.exists()) {
      currentXp = repDoc.data().xp || 0;
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

    // Actualizar también en el documento del usuario
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      await updateDoc(userRef, {
        xp: newXp,
        level: newLevel,
        rank: newRank,
      });
    }

    return await this.getByUserId(userId) as UserReputation;
  }

  async setTrophiesCount(userId: string, count: number): Promise<UserReputation> {
    const repRef = doc(db, "reputation", userId);
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

    return await this.getByUserId(userId) as UserReputation;
  }

  reset(): void {
    // No hay nada que resetear en Firestore (esto es para testing)
  }
}

