import type { Notification } from "../../domain/notifications";
import { InMemoryNotificationsRepository } from "./InMemoryNotificationsRepository";
import type { NotificationsRepository } from "./NotificationsRepository";

class NotificationsService {
  private repo: NotificationsRepository;

  constructor(repo: NotificationsRepository) {
    this.repo = repo;
  }

  listForUser(userId: string) {
    return this.repo.listForUser(userId);
  }

  create(notification: Notification) {
    return this.repo.create(notification);
  }

  markRead(userId: string, notificationId: string) {
    return this.repo.markRead(userId, notificationId);
  }

  markAllRead(userId: string) {
    return this.repo.markAllRead(userId);
  }

  onChanged(listener: () => void) {
    return this.repo.onChanged(listener);
  }

  reset() {
    return this.repo.reset();
  }
}

export const notificationsService = new NotificationsService(new InMemoryNotificationsRepository());


