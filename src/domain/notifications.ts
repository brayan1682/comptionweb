export type NotificationType = "question/new-answer" | "question/rated" | "answer/rated" | "reputation/level-up" | "reputation/rank-up";

export type Notification = {
  id: string;
  userId: string; // Destinatario
  actorId: string; // Quien genera la notificación (debe ser auth.uid)
  type: NotificationType;
  createdAt: string; // ISO
  readAt: string | null;
  message?: string; // Mensaje de la notificación (requerido para Firestore)
  data:
    | { questionId: string; answerId: string; fromUserId: string }
    | { questionId: string; answerId: string; fromUserId: string; rating: number; ratingAvg: number }
    | { level: number; rank: string };
};
