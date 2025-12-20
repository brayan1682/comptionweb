import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  where,
  Timestamp
} from "firebase/firestore";
import { nowIso } from "../utils";
import type { FollowedQuestion, SavedQuestion, UserDataRepository } from "./UserDataRepository";
import { db } from "../../firebase/firebase";

export class FirestoreUserDataRepository implements UserDataRepository {
  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  async saveQuestion(userId: string, questionId: string): Promise<SavedQuestion> {
    const savedRef = doc(collection(db, "savedQuestions"), `${userId}_${questionId}`);
    const saved: SavedQuestion = {
      userId,
      questionId,
      savedAt: nowIso(),
    };
    
    await setDoc(savedRef, {
      ...saved,
      savedAt: this.isoToTimestamp(saved.savedAt),
    });
    
    return saved;
  }

  async unsaveQuestion(userId: string, questionId: string): Promise<void> {
    const savedRef = doc(db, "savedQuestions", `${userId}_${questionId}`);
    await deleteDoc(savedRef);
  }

  async getSavedQuestions(userId: string): Promise<string[]> {
    const savedRef = collection(db, "savedQuestions");
    const q = query(savedRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => doc.data().questionId);
  }

  async isQuestionSaved(userId: string, questionId: string): Promise<boolean> {
    const savedRef = doc(db, "savedQuestions", `${userId}_${questionId}`);
    const savedDoc = await getDoc(savedRef);
    return savedDoc.exists();
  }

  async followQuestion(userId: string, questionId: string): Promise<FollowedQuestion> {
    const followedRef = doc(collection(db, "followedQuestions"), `${userId}_${questionId}`);
    const followed: FollowedQuestion = {
      userId,
      questionId,
      followedAt: nowIso(),
    };
    
    await setDoc(followedRef, {
      ...followed,
      followedAt: this.isoToTimestamp(followed.followedAt),
    });
    
    return followed;
  }

  async unfollowQuestion(userId: string, questionId: string): Promise<void> {
    const followedRef = doc(db, "followedQuestions", `${userId}_${questionId}`);
    await deleteDoc(followedRef);
  }

  async getFollowedQuestions(userId: string): Promise<string[]> {
    const followedRef = collection(db, "followedQuestions");
    const q = query(followedRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => doc.data().questionId);
  }

  async getQuestionFollowers(questionId: string): Promise<string[]> {
    const followedRef = collection(db, "followedQuestions");
    const q = query(followedRef, where("questionId", "==", questionId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => doc.data().userId);
  }

  async isQuestionFollowed(userId: string, questionId: string): Promise<boolean> {
    const followedRef = doc(db, "followedQuestions", `${userId}_${questionId}`);
    const followedDoc = await getDoc(followedRef);
    return followedDoc.exists();
  }

  reset(): void {
    // No hay nada que resetear en Firestore (esto es para testing)
  }
}




