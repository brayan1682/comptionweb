import type { Notification } from "../../domain/notifications";
import { newId, nowIso } from "../utils";

export function newAnswerNotification(input: { userId: string; questionId: string; answerId: string; fromUserId: string }): Notification {
  return {
    id: newId(),
    userId: input.userId,
    type: "question/new-answer",
    createdAt: nowIso(),
    readAt: null,
    data: { questionId: input.questionId, answerId: input.answerId, fromUserId: input.fromUserId }
  };
}

export function answerRatedNotification(input: {
  userId: string;
  questionId: string;
  answerId: string;
  fromUserId: string;
  rating: number;
  ratingAvg: number;
}): Notification {
  return {
    id: newId(),
    userId: input.userId,
    type: "answer/rated",
    createdAt: nowIso(),
    readAt: null,
    data: {
      questionId: input.questionId,
      answerId: input.answerId,
      fromUserId: input.fromUserId,
      rating: input.rating,
      ratingAvg: input.ratingAvg
    }
  };
}

export function levelUpNotification(input: { userId: string; level: number; rank: string }): Notification {
  return {
    id: newId(),
    userId: input.userId,
    type: "reputation/level-up",
    createdAt: nowIso(),
    readAt: null,
    data: { level: input.level, rank: input.rank }
  };
}

export function rankUpNotification(input: { userId: string; level: number; rank: string }): Notification {
  return {
    id: newId(),
    userId: input.userId,
    type: "reputation/rank-up",
    createdAt: nowIso(),
    readAt: null,
    data: { level: input.level, rank: input.rank }
  };
}



