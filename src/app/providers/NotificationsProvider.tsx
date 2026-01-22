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
    // ✅ FIX: No ejecutar si no hay auth
    if (!user) {
      setNotifications([]);
      return;
    }
    
    try {
      const list = await notificationsService.listForUser(user.id);
      setNotifications(list);
    } catch (error: any) {
      console.warn("[NotificationsProvider] Error refrescando notificaciones:", error.message);
      // No romper la app, mantener array vacío
      setNotifications([]);
    }
  }

  useEffect(() => {
    // ✅ FIX: Solo refrescar si hay user
    if (!user) {
      setNotifications([]);
      return;
    }
    
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // ✅ FIX: No montar listener si no hay auth
    if (!user) {
      return;
    }
    
    // Escuchar cambios en tiempo real filtrando por usuario para evitar permission-denied
    const unsub = notificationsService.onChanged(() => {
      refresh();
    }, user.id);
    
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
        try {
          await notificationsService.markRead(user.id, notificationId);
          await refresh();
        } catch (error: any) {
          console.warn("[NotificationsProvider] Error marcando notificación como leída:", error.message);
        }
      },
      markAllRead: async () => {
        if (!user) return;
        try {
          await notificationsService.markAllRead(user.id);
          await refresh();
        } catch (error: any) {
          console.warn("[NotificationsProvider] Error marcando todas como leídas:", error.message);
        }
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
