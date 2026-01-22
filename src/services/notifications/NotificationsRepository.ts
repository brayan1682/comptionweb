import type { Notification } from "../../domain/notifications";

export type NotificationsListener = () => void;

export interface NotificationsRepository {
  listForUser(userId: string): Promise<Notification[]>;
  create(notification: Notification): Promise<void>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  onChanged(listener: NotificationsListener, userId?: string): () => void;
  reset(): void;
}


