// Sistema de rangos (limitados, 8-10 máximo)
export const RANKS = [
  "Novato",
  "Aprendiz",
  "Sabelotodo",
  "Analista",
  "Arquitecto",
  "Hacker Ético",
  "Mentor",
  "Leyenda Tech"
] as const;

export type Rank = (typeof RANKS)[number];

// Cálculo de nivel basado en XP (crecimiento progresivo)
// Fórmula: nivel = floor(sqrt(XP / 100)) + 1
// Esto hace que cada nivel requiera más XP que el anterior
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// XP requerido para alcanzar un nivel específico
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.pow((level - 1) * 10, 2);
}

// XP para el siguiente nivel
export function xpForNextLevel(currentLevel: number): number {
  return xpRequiredForLevel(currentLevel + 1);
}

// Determinar rango basado en nivel
// Cada rango agrupa varios niveles
// Rango 1 (Novato): niveles 1-5
// Rango 2 (Aprendiz): niveles 6-10
// Rango 3 (Sabelotodo): niveles 11-15
// Rango 4 (Analista): niveles 16-20
// Rango 5 (Arquitecto): niveles 21-25
// Rango 6 (Hacker Ético): niveles 26-30
// Rango 7 (Mentor): niveles 31-35
// Rango 8 (Leyenda Tech): nivel 36+
export function calculateRank(level: number): Rank {
  if (level <= 5) return RANKS[0];
  if (level <= 10) return RANKS[1];
  if (level <= 15) return RANKS[2];
  if (level <= 20) return RANKS[3];
  if (level <= 25) return RANKS[4];
  if (level <= 30) return RANKS[5];
  if (level <= 35) return RANKS[6];
  return RANKS[7]; // Leyenda Tech (nivel 36+)
}

// Valores de XP por acción
export const XP_VALUES = {
  ANSWER_PUBLISHED: 5, // XP bajo
  ANSWER_WELL_RATED: 15, // XP medio (cuando recibe rating >= 4)
  QUESTION_WELL_RATED: 15, // XP medio (cuando recibe rating >= 4)
  TROPHY_OBTAINED: 50 // XP alto (la mayor recompensa)
} as const;

