import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Notification } from "../../domain/notifications";
import { notificationsService } from "../../services/notifications/notificationsService";
import { useAuth } from "./AuthProvider";

type NotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  async function refresh() {
    if (!user) {
      setNotifications([]);
      return;
    }
    const list = await notificationsService.listForUser(user.id);
    setNotifications(list);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Preparado para “tiempo real”: hoy es un listener interno (mañana sería onSnapshot de Firestore)
    const unsub = notificationsService.onChanged(() => {
      refresh();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return {
      notifications,
      unreadCount,
      refresh,
      markRead: async (notificationId: string) => {
        if (!user) return;
        await notificationsService.markRead(user.id, notificationId);
        await refresh();
      },
      markAllRead: async () => {
        if (!user) return;
        await notificationsService.markAllRead(user.id);
        await refresh();
      },
      reset: () => {
        notificationsService.reset();
        setNotifications([]);
      }
    };
  }, [notifications, user]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de <NotificationsProvider />");
  return ctx;
}


