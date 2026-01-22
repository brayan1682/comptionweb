/**
 * XP Synchronization Utilities
 * 
 * Ensures XP, level, and rank are always synchronized between:
 * - /users/{userId}
 * - /publicProfiles/{userId}
 * 
 * All XP changes must use these utilities to maintain consistency.
 */

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Firestore,
  Transaction,
} from "firebase/firestore";
import { calculateLevel, calculateRank } from "./reputationUtils";


/**
 * Helper to sync XP when documents might not exist
 * Reads documents first, then updates or creates them
 * 
 * @param tx Firestore transaction
 * @param db Firestore instance
 * @param userId User ID to update
 * @param xpDelta Amount of XP to add (can be negative for subtraction)
 * @param userEmail Optional email for user document creation
 * @returns Promise resolving to the new XP value
 */
export async function syncXpChangeWithReads(
  tx: Transaction,
  db: Firestore,
  userId: string,
  xpDelta: number,
  userEmail: string = ""
): Promise<number> {
  const userRef = doc(db, "users", userId);
  const publicProfileRef = doc(db, "publicProfiles", userId);
  
  const userSnap = await tx.get(userRef);
  const publicProfileSnap = await tx.get(publicProfileRef);

  // Get current XP from either document
  let currentXp = 0;
  if (userSnap.exists()) {
    currentXp = Number(userSnap.data()?.xp || 0);
  } else if (publicProfileSnap.exists()) {
    currentXp = Number(publicProfileSnap.data()?.xp || 0);
  }

  // Calculate new XP (never negative)
  const newXp = Math.max(0, currentXp + xpDelta);
  const newLevel = calculateLevel(newXp);
  const newRank = calculateRank(newLevel);

  // Update /users/{userId}
  if (userSnap.exists()) {
    tx.update(userRef, {
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create document if it doesn't exist
    tx.set(userRef, {
      uid: userId,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      questionsCount: 0,
      answersCount: 0,
      savedCount: 0,
      followedCount: 0,
      avgRating: 0,
      name: "",
      displayName: "",
      email: userEmail,
      role: "USER",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // ✅ Update /publicProfiles/{userId} as projection of users/{userId}
  // Sync avgRating from users/{userId} if available
  const userAvgRating = userSnap.exists() ? Number(userSnap.data()?.avgRating || 0) : 0;
  
  if (publicProfileSnap.exists()) {
    const updateData: any = {
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updatedAt: serverTimestamp(),
    };
    // ✅ Sync avgRating from users/{userId} if it exists
    if (userSnap.exists() && userSnap.data()?.avgRating !== undefined) {
      updateData.avgRating = userAvgRating;
    }
    tx.update(publicProfileRef, updateData);
  } else {
    // Create document if it doesn't exist
    tx.set(publicProfileRef, {
      userId: userId,
      uid: userId,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      trophiesCount: 0,
      questionsCount: 0,
      answersCount: 0,
      avgRating: userAvgRating, // ✅ Use avgRating from users/{userId}
      displayName: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return newXp;
}

/**
 * Syncs XP using already-read snapshots (more efficient when snapshots are already available)
 * 
 * @param tx Firestore transaction
 * @param db Firestore instance
 * @param userId User ID to update
 * @param userSnap User document snapshot (already read)
 * @param publicProfileSnap Public profile document snapshot (already read)
 * @param xpDelta Amount of XP to add (can be negative for subtraction)
 * @param userEmail Optional email for user document creation
 * @returns The new XP value
 */
export function syncXpChangeWithSnapshots(
  tx: Transaction,
  db: Firestore,
  userId: string,
  userSnap: any, // DocumentSnapshot
  publicProfileSnap: any, // DocumentSnapshot
  xpDelta: number,
  userEmail: string = ""
): number {
  // Get current XP from either document
  let currentXp = 0;
  if (userSnap.exists()) {
    currentXp = Number(userSnap.data()?.xp || 0);
  } else if (publicProfileSnap.exists()) {
    currentXp = Number(publicProfileSnap.data()?.xp || 0);
  }

  // Calculate new XP (never negative)
  const newXp = Math.max(0, currentXp + xpDelta);
  const newLevel = calculateLevel(newXp);
  const newRank = calculateRank(newLevel);

  const userRef = doc(db, "users", userId);
  const publicProfileRef = doc(db, "publicProfiles", userId);

  // Update /users/{userId}
  if (userSnap.exists()) {
    tx.update(userRef, {
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create document if it doesn't exist
    tx.set(userRef, {
      uid: userId,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      questionsCount: 0,
      answersCount: 0,
      savedCount: 0,
      followedCount: 0,
      avgRating: 0,
      name: "",
      displayName: "",
      email: userEmail,
      role: "USER",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // ✅ Update /publicProfiles/{userId} as projection of users/{userId}
  // Sync avgRating from users/{userId} if available
  const userAvgRating = userSnap.exists() ? Number(userSnap.data()?.avgRating || 0) : 0;
  
  if (publicProfileSnap.exists()) {
    const updateData: any = {
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updatedAt: serverTimestamp(),
    };
    // ✅ Sync avgRating from users/{userId} if it exists
    if (userSnap.exists() && userSnap.data()?.avgRating !== undefined) {
      updateData.avgRating = userAvgRating;
    }
    tx.update(publicProfileRef, updateData);
  } else {
    // Create document if it doesn't exist
    tx.set(publicProfileRef, {
      userId: userId,
      uid: userId,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      trophiesCount: 0,
      questionsCount: 0,
      answersCount: 0,
      avgRating: userAvgRating, // ✅ Use avgRating from users/{userId}
      displayName: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return newXp;
}

/**
 * Standalone function to sync XP (creates its own transaction)
 * Use this when you're not already in a transaction
 * 
 * @param db Firestore instance
 * @param userId User ID to update
 * @param xpDelta Amount of XP to add (can be negative for subtraction)
 * @returns Promise resolving to the new XP value
 */
export async function syncXpChange(
  db: Firestore,
  userId: string,
  xpDelta: number
): Promise<number> {
  if (xpDelta === 0) {
    // No change needed, just return current XP
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return Number(userSnap.data()?.xp || 0);
    }
    const publicProfileRef = doc(db, "publicProfiles", userId);
    const publicProfileSnap = await getDoc(publicProfileRef);
    return Number(publicProfileSnap.data()?.xp || 0);
  }

  return await runTransaction(db, async (tx) => {
    return await syncXpChangeWithReads(tx, db, userId, xpDelta);
  });
}


