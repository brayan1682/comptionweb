import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import type { Notification } from "../../domain/notifications";
import { nowIso } from "../utils";
import type { NotificationsRepository } from "./NotificationsRepository";
import { db } from "../../firebase/firebase";

export class FirestoreNotificationsRepository implements NotificationsRepository {
  private listeners = new Set<() => void>();
  private unsubscribeSnapshots: (() => void)[] = [];

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

  async listForUser(userId: string): Promise<Notification[]> {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        createdAt: this.timestampToIso(data.createdAt),
        readAt: data.readAt ? this.timestampToIso(data.readAt) : null,
        data: data.data,
      };
    });
  }

  async create(notification: Notification): Promise<void> {
    const notificationRef = doc(collection(db, "notifications"), notification.id);
    await setDoc(notificationRef, {
      ...notification,
      createdAt: this.isoToTimestamp(notification.createdAt),
      readAt: notification.readAt ? this.isoToTimestamp(notification.readAt) : null,
    });
    
    // Notificar a los listeners
    this.listeners.forEach((l) => l());
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    const notificationDoc = await getDoc(notificationRef);
    
    if (!notificationDoc.exists()) return;
    
    const data = notificationDoc.data();
    if (data.userId !== userId) return;
    if (data.readAt) return;
    
    await updateDoc(notificationRef, {
      readAt: this.isoToTimestamp(nowIso()),
    });
    
    this.listeners.forEach((l) => l());
  }

  async markAllRead(userId: string): Promise<void> {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    
    const now = this.isoToTimestamp(nowIso());
    const updates = snapshot.docs
      .filter((doc) => !doc.data().readAt)
      .map((doc) => updateDoc(doc.ref, { readAt: now }));
    
    await Promise.all(updates);
    this.listeners.forEach((l) => l());
  }

  onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    
    // Escuchar cambios en tiempo real (opcional, para mejor UX)
    const notificationsRef = collection(db, "notifications");
    const unsubscribe = onSnapshot(notificationsRef, () => {
      listener();
    });
    
    this.unsubscribeSnapshots.push(unsubscribe);
    
    return () => {
      this.listeners.delete(listener);
      const index = this.unsubscribeSnapshots.indexOf(unsubscribe);
      if (index > -1) {
        this.unsubscribeSnapshots[index]();
        this.unsubscribeSnapshots.splice(index, 1);
      }
    };
  }

  reset(): void {
    this.listeners.clear();
    this.unsubscribeSnapshots.forEach((unsub) => unsub());
    this.unsubscribeSnapshots = [];
  }
}

