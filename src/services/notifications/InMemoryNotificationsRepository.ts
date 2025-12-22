import type { Notification } from "../../domain/notifications";
import { nowIso } from "../utils";
import type { NotificationsRepository } from "./NotificationsRepository";

export class InMemoryNotificationsRepository implements NotificationsRepository {
  private items: Notification[] = [];
  private listeners = new Set<() => void>();

  async listForUser(userId: string): Promise<Notification[]> {
    return this.items
      .filter((n) => n.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(notification: Notification): Promise<void> {
    this.items.push(notification);
    this.listeners.forEach((l) => l());
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const n = this.items.find((x) => x.id === notificationId && x.userId === userId);
    if (!n) return;
    if (n.readAt) return;
    n.readAt = nowIso();
    this.listeners.forEach((l) => l());
  }

  async markAllRead(userId: string): Promise<void> {
    const now = nowIso();
    for (const n of this.items) {
      if (n.userId === userId && !n.readAt) n.readAt = now;
    }
    this.listeners.forEach((l) => l());
  }

  onChanged(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    this.items = [];
    this.listeners.clear();
  }
}


