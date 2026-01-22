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
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import type { Notification } from "../../domain/notifications";
import type { NotificationsRepository } from "./NotificationsRepository";
import { db } from "../../firebase/firebase";

function safeErr(e: any): string {
  return e?.message || e?.code || String(e);
}

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

  async listForUser(userId: string): Promise<Notification[]> {
    const notificationsRef = collection(db, "notifications");
    const path = `notifications (where toUserId == ${userId})`;
    
    // ✅ FIX: Usar toUserId según reglas de seguridad (compatibilidad con userId antiguo)
    let snapshot;
    try {
      const q = query(
        notificationsRef,
        where("toUserId", "==", userId),
        orderBy("createdAt", "desc")
      );
      snapshot = await getDocs(q);
    } catch (indexError: any) {
      const errorCode = indexError?.code || "unknown";
      if (errorCode === "failed-precondition") {
        console.warn(`[FirestoreNotificationsRepository] orderBy falló (índice faltante) en ${path}, leyendo sin orden: ${indexError.message}`);
        try {
          const q = query(
            notificationsRef,
            where("toUserId", "==", userId)
          );
          snapshot = await getDocs(q);
        } catch (fallbackError: any) {
          // ✅ Si también falla el fallback, puede ser permission-denied
          const fallbackCode = fallbackError?.code || "unknown";
          console.warn(`[FirestoreNotificationsRepository] ⚠️ Error leyendo notificaciones (${path}): ${fallbackCode} - ${safeErr(fallbackError)}`);
          // ✅ Retornar array vacío en lugar de lanzar error
          return [];
        }
      } else {
        // ✅ Permission-denied u otro error
        console.warn(`[FirestoreNotificationsRepository] ⚠️ Error leyendo notificaciones (${path}): ${errorCode} - ${safeErr(indexError)}`);
        return [];
      }
    }
    
    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      const isRead = Boolean(data.read) || Boolean(data.readAt);
      // ✅ Mapear toUserId -> userId para compatibilidad con el tipo Notification
      const notificationUserId = data.toUserId || data.userId || ""; // Compatibilidad con datos antiguos
      return {
        id: doc.id,
        userId: notificationUserId,
        actorId: data.actorId || data.fromUserId || "", // ✅ Compatibilidad con notificaciones antiguas
        type: data.type,
        createdAt: this.timestampToIso(data.createdAt),
        // Compatibilidad:
        // - Nuevo: read (boolean) + readAt (timestamp | null)
        // - Antiguo: solo readAt
        readAt: data.readAt ? this.timestampToIso(data.readAt) : (isRead ? this.timestampToIso(data.createdAt) : null),
        message: typeof data.message === "string" ? data.message : "",
        data: data.data ?? null,
      };
    });
    
    // Ordenar manualmente si no se pudo ordenar con orderBy
    notifications.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    
    return notifications;
  }

  async create(notification: Notification): Promise<void> {
    // Guardar SOLO los campos permitidos por reglas (y compatibles con UI)
    // Nota: Firestore no soporta timestamps como string en el doc.
    const notificationRef = doc(collection(db, "notifications"), notification.id);

    // ✅ Asegurar que actorId = auth.uid según reglas
    const { auth } = await import("../../firebase/firebase");
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      console.warn(`[FirestoreNotificationsRepository] ⚠️ No hay auth.uid, no se puede crear notificación`);
      return; // ✅ No lanzar error - las notificaciones son secundarias
    }

    // ✅ Validar toUserId según reglas
    if (!notification.userId || notification.userId.trim().length === 0) {
      console.warn(`[FirestoreNotificationsRepository] ⚠️ toUserId inválido, no se puede crear notificación`);
      return; // ✅ No lanzar error
    }

    // ✅ Según reglas: campos permitidos son type, toUserId, fromUserId, questionId, answerId, message, read, createdAt
    // ✅ fromUserId == uid() es requerido por reglas
    const notificationData = notification.data as any;
    const firestoreDoc = {
      type: notification.type,
      toUserId: notification.userId, // ✅ Requerido: string, size > 0
      fromUserId: currentUid, // ✅ Requerido: fromUserId == uid()
      questionId: notificationData?.questionId || "",
      answerId: notificationData?.answerId || "",
      message: notification.message || "",
      read: false, // ✅ Requerido: bool
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(notificationRef, firestoreDoc);
      const path = `notifications/${notification.id}`;
      console.log(`[FirestoreNotificationsRepository] ✓ Notificación creada: ${path}`, {
        toUserId: notification.userId,
        fromUserId: currentUid,
        type: notification.type,
      });
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      const errorMessage = safeErr(e);
      const path = `notifications/${notification.id}`;
      console.error(`[FirestoreNotificationsRepository] ❌ Error creando notificación (${path}): ${errorCode} - ${errorMessage}`);
      // ✅ No lanzar error - las notificaciones son secundarias
      return;
    }
    
    // Notificar a los listeners
    this.listeners.forEach((l) => l());
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    const path = `notifications/${notificationId}`;
    
    try {
      const notificationDoc = await getDoc(notificationRef);
      
      if (!notificationDoc.exists()) return;
      
      const data = notificationDoc.data();
      // ✅ Usar toUserId según reglas (compatibilidad con userId antiguo)
      const notificationToUserId = data.toUserId || data.userId || "";
      if (notificationToUserId !== userId) return;
      if (data.readAt || data.read === true) return;

      // ✅ Según reglas: solo se puede actualizar el campo 'read' (bool)
      await updateDoc(notificationRef, {
        read: true, // ✅ Requerido: read is bool
      });
    } catch (e: any) {
      const code = e?.code || "unknown";
      const msg = safeErr(e);
      if (code === "permission-denied") {
        console.warn(
          `[FirestoreNotificationsRepository] ⚠️ PERMISSION-DENIED en markRead (${path}): ${msg}`
        );
        return; // no crashear UI
      }
      console.warn(`[FirestoreNotificationsRepository] ⚠️ Error en markRead (${path}): ${code} - ${msg}`);
      return; // ✅ Best-effort: no lanzar error
    }
    
    this.listeners.forEach((l) => l());
  }

  async markAllRead(userId: string): Promise<void> {
    const notificationsRef = collection(db, "notifications");
    const path = `notifications (where toUserId == ${userId})`;
    
    // ✅ FIX: Usar toUserId según reglas de seguridad
    let snapshot;
    try {
      const q = query(
        notificationsRef,
        where("toUserId", "==", userId),
        orderBy("createdAt", "desc")
      );
      snapshot = await getDocs(q);
    } catch (indexError: any) {
      const errorCode = indexError?.code || "unknown";
      if (errorCode === "failed-precondition") {
        console.warn(`[FirestoreNotificationsRepository] orderBy falló (índice faltante) en ${path}, leyendo sin orden: ${indexError.message}`);
        try {
          const q = query(
            notificationsRef,
            where("toUserId", "==", userId)
          );
          snapshot = await getDocs(q);
        } catch (fallbackError: any) {
          const fallbackCode = fallbackError?.code || "unknown";
          console.warn(`[FirestoreNotificationsRepository] ⚠️ Error leyendo notificaciones (${path}): ${fallbackCode} - ${safeErr(fallbackError)}`);
          return; // ✅ Best-effort: retornar sin error
        }
      } else {
        console.warn(`[FirestoreNotificationsRepository] ⚠️ Error leyendo notificaciones (${path}): ${errorCode} - ${safeErr(indexError)}`);
        return; // ✅ Best-effort: retornar sin error
      }
    }
    
    // ✅ Según reglas: solo se puede actualizar el campo 'read' (bool)
    const updates = snapshot.docs
      .filter((doc) => !(doc.data().readAt || doc.data().read === true))
      .map((doc) => updateDoc(doc.ref, { read: true })); // ✅ Solo campo 'read' permitido
    
    try {
      await Promise.all(updates);
    } catch (e: any) {
      const code = e?.code || "unknown";
      const msg = safeErr(e);
      console.warn(`[FirestoreNotificationsRepository] ⚠️ Error en markAllRead (${path}): ${code} - ${msg}`);
      // ✅ Best-effort: no lanzar error
      return;
    }
    this.listeners.forEach((l) => l());
  }

  onChanged(listener: () => void, userId?: string): () => void {
    this.listeners.add(listener);
    
    // ✅ FIX: Si no hay userId, solo usar el listener interno (sin snapshot)
    if (!userId) {
      return () => {
        this.listeners.delete(listener);
      };
    }
    
    // Escuchar cambios en tiempo real filtrando por usuario para evitar permission-denied
    const notificationsRef = collection(db, "notifications");
    const path = `notifications (where toUserId == ${userId})`;
    
    // ✅ FIX: Usar toUserId según reglas de seguridad y manejar errores
    let q;
    try {
      q = query(
        notificationsRef,
        where("toUserId", "==", userId),
        orderBy("createdAt", "desc")
      );
    } catch (indexError: any) {
      const errorCode = indexError?.code || "unknown";
      if (errorCode === "failed-precondition") {
        console.warn(`[FirestoreNotificationsRepository] orderBy falló en listener (índice faltante) en ${path}, usando sin orden: ${indexError.message}`);
        try {
          q = query(
            notificationsRef,
            where("toUserId", "==", userId)
          );
        } catch (fallbackError: any) {
          const fallbackCode = fallbackError?.code || "unknown";
          console.warn(`[FirestoreNotificationsRepository] ⚠️ Error creando query para listener (${path}): ${fallbackCode} - ${safeErr(fallbackError)}`);
          // ✅ Retornar un unsubscribe no-op si no se puede crear el listener
          return () => {
            this.listeners.delete(listener);
          };
        }
      } else {
        console.warn(`[FirestoreNotificationsRepository] ⚠️ Error creando query para listener (${path}): ${errorCode} - ${safeErr(indexError)}`);
        // ✅ Retornar un unsubscribe no-op si no se puede crear el listener
        return () => {
          this.listeners.delete(listener);
        };
      }
    }
    
    // Manejar errores del listener
    const unsubscribe = onSnapshot(
      q,
      () => {
        listener();
      },
      (error) => {
        const errorCode = error?.code || "unknown";
        const errorMessage = safeErr(error);
        console.warn(`[FirestoreNotificationsRepository] ⚠️ Error en listener de notificaciones (${path}): ${errorCode} - ${errorMessage}`);
        // ✅ Continuar funcionando aunque falle el listener (no lanzar error)
      }
    );
    
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
