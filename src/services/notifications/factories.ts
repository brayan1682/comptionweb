import type { Notification } from "../../domain/notifications";
import { newId, nowIso } from "../utils";
import { auth } from "../../firebase/firebase";

export function newAnswerNotification(input: { userId: string; questionId: string; answerId: string; fromUserId: string }): Notification {
  const actorId = auth.currentUser?.uid || input.fromUserId;
  return {
    id: newId(),
    userId: input.userId,
    actorId: actorId,
    type: "question/new-answer",
    createdAt: nowIso(),
    readAt: null,
    message: `Nueva respuesta en tu pregunta`,
    data: { questionId: input.questionId, answerId: input.answerId, fromUserId: input.fromUserId }
  };
}

export function questionRatedNotification(input: {
  userId: string;
  questionId: string;
  fromUserId: string;
  rating: number;
  ratingAvg: number;
}): Notification {
  const actorId = auth.currentUser?.uid || input.fromUserId;
  return {
    id: newId(),
    userId: input.userId,
    actorId: actorId,
    type: "question/rated",
    createdAt: nowIso(),
    readAt: null,
    message: `Tu pregunta recibió ${input.rating} estrella${input.rating > 1 ? 's' : ''}`,
    data: {
      questionId: input.questionId,
      answerId: "", // No aplica para preguntas
      fromUserId: input.fromUserId,
      rating: input.rating,
      ratingAvg: input.ratingAvg
    }
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
  const actorId = auth.currentUser?.uid || input.fromUserId;
  return {
    id: newId(),
    userId: input.userId,
    actorId: actorId,
    type: "answer/rated",
    createdAt: nowIso(),
    readAt: null,
    message: `Tu respuesta recibió ${input.rating} estrella${input.rating > 1 ? 's' : ''}`,
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
  const actorId = auth.currentUser?.uid || input.userId;
  return {
    id: newId(),
    userId: input.userId,
    actorId: actorId,
    type: "reputation/level-up",
    createdAt: nowIso(),
    readAt: null,
    message: `¡Subiste al nivel ${input.level}!`,
    data: { level: input.level, rank: input.rank }
  };
}

export function rankUpNotification(input: { userId: string; level: number; rank: string }): Notification {
  const actorId = auth.currentUser?.uid || input.userId;
  return {
    id: newId(),
    userId: input.userId,
    actorId: actorId,
    type: "reputation/rank-up",
    createdAt: nowIso(),
    readAt: null,
    message: `¡Nuevo rango: ${input.rank}!`,
    data: { level: input.level, rank: input.rank }
  };
}
