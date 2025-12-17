export type Role = "USER" | "EXPERT" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string; // ISO (Firestore Timestamp -> string en demo)
  updatedAt: string; // ISO
};

export type Answer = {
  id: string;
  questionId: string;
  content: string;
  authorId: string;
  authorName: string; // snapshot / denormalizado (Firestore-ready)
  isAnonymous: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  // Ratings 1..5 (entrada entera; promedio puede ser fraccionario)
  ratingsByUserId: Record<string, number>; // userId -> rating
  ratingAvg: number;
  ratingCount: number;
};

export type Question = {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string; // snapshot / denormalizado
  isAnonymous: boolean;
  category: string; // Categoría principal (obligatoria)
  tags: string[]; // Etiquetas predefinidas (1-5)
  createdAt: string; // ISO
  updatedAt: string; // ISO
  answers: Answer[];

  // Vistas únicas por usuario autenticado
  viewedByUserId: Record<string, true>; // userId -> true
  viewsCount: number; // denormalizado para Firestore

  // Ratings 1..5 (entrada entera; promedio puede ser fraccionario)
  ratingsByUserId: Record<string, number>; // userId -> rating
  ratingAvg: number;
  ratingCount: number;

  // Trofeo al mejor aporte
  trophyAnswerId: string | null; // ID de la respuesta con trofeo (si existe)
};

// Sistema de reputación del usuario
export type UserReputation = {
  userId: string;
  xp: number; // Experiencia total acumulada
  level: number; // Nivel actual (infinito)
  rank: string; // Rango actual (limitado)
  trophiesCount: number; // Número de trofeos obtenidos
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// Sistema de reportes
export type ReportReason = "spam" | "inappropriate" | "offensive" | "duplicate" | "other";

export type Report = {
  id: string;
  reporterId: string; // Usuario que reporta
  targetType: "question" | "answer";
  targetId: string; // ID de la pregunta o respuesta reportada
  questionId: string | null; // Para respuestas, ID de la pregunta padre
  reason: ReportReason;
  description: string; // Descripción adicional del reporte
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  reviewedBy: string | null; // ID del admin que revisó
  reviewedAt: string | null; // ISO
  createdAt: string; // ISO
};
