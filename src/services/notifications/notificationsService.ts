import type { Notification } from "../../domain/notifications";
import { FirestoreNotificationsRepository } from "./FirestoreNotificationsRepository";
import type { NotificationsRepository } from "./NotificationsRepository";
import { auth } from "../../firebase/firebase";

/**
 * ✅ FIX: Las reglas de Firestore SOLO permiten estos campos:
 * ["userId","actorId","type","message","createdAt","read"]
 *
 * El repositorio FirestoreNotificationsRepository.create() se encarga de limpiar
 * los campos extra antes de guardar en Firestore.
 */
function requireAuthUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("auth/not-authenticated");
  return uid;
}

class NotificationsService {
  private repo: NotificationsRepository;

  constructor(repo: NotificationsRepository) {
    this.repo = repo;
  }

  listForUser(userId: string) {
    return this.repo.listForUser(userId);
  }

  /**
   * ✅ FIX:
   * - Valida que actorId sea el uid actual (reglas lo exigen)
   * - El repositorio se encarga de limpiar campos extra antes de guardar
   */
  async create(notification: Notification) {
    const authUid = requireAuthUid();
    
    // Validar que actorId sea el usuario autenticado (reglas lo exigen)
    if (notification.actorId !== authUid) {
      console.warn(`[notificationsService.create] ⚠️ WARNING: actorId (${notification.actorId}) no coincide con uid actual (${authUid}), corrigiendo...`);
      notification.actorId = authUid;
    }
    
    // Validar que message exista (requerido por las reglas)
    if (!notification.message || notification.message.trim() === "") {
      console.warn(`[notificationsService.create] ⚠️ WARNING: notification.message está vacío, usando mensaje por defecto`);
      notification.message = notification.message || `Notificación de tipo ${notification.type}`;
    }
    
    try {
      const res = await this.repo.create(notification);
      console.log("[notificationsService.create] ✅ Notificación enviada al repositorio:", { 
        userId: notification.userId, 
        type: notification.type,
        actorId: notification.actorId 
      });
      return res;
    } catch (e: any) {
      const errorCode = e?.code || "unknown";
      const errorMessage = e?.message || String(e);
      console.error(`[notificationsService.create] ❌ Error al crear notificación. Error code: ${errorCode}, message: ${errorMessage}`, {
        notification: {
          id: notification.id,
          userId: notification.userId,
          actorId: notification.actorId,
          type: notification.type,
          message: notification.message
        }
      });
      throw e;
    }
  }

  markRead(userId: string, notificationId: string) {
    return this.repo.markRead(userId, notificationId);
  }

  markAllRead(userId: string) {
    return this.repo.markAllRead(userId);
  }

  onChanged(listener: () => void, userId?: string) {
    return this.repo.onChanged(listener, userId);
  }

  reset() {
    return this.repo.reset();
  }
}

export const notificationsService = new NotificationsService(new FirestoreNotificationsRepository());
