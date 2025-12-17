export type NotificationType = "question/new-answer" | "answer/rated";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  createdAt: string; // ISO
  readAt: string | null;
  data:
    | { questionId: string; answerId: string; fromUserId: string }
    | { questionId: string; answerId: string; fromUserId: string; rating: number; ratingAvg: number };
};



