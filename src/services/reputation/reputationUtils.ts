export const RANKS = [
  "Novato",        // 1-5
  "Aprendiz",      // 6-12
  "Colaborador",   // 13-20
  "Contribuyente", // 21-30
  "Explorador",    // 31-42
  "Analista",      // 43-56
  "Mentor",        // 57-72
  "Especialista",  // 73-90
  "Referente",     // 91-110
  "Leyenda",       // 111+
] as const;

export type Rank = (typeof RANKS)[number];

export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;

  let level = 1;
  let totalXpNeeded = 0;
  let xpForCurrentLevel = 100;

  while (totalXpNeeded + xpForCurrentLevel <= xp) {
    totalXpNeeded += xpForCurrentLevel;
    level++;

    const incrementPercent = Math.min(0.10 + (level - 2) * 0.005, 0.15);
    xpForCurrentLevel = Math.floor(xpForCurrentLevel * (1 + incrementPercent));
  }

  return level;
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 100;

  let totalXp = 100;
  let xpForLevel = 100;

  for (let i = 3; i <= level; i++) {
    const incrementPercent = Math.min(0.10 + (i - 2) * 0.005, 0.15);
    xpForLevel = Math.floor(xpForLevel * (1 + incrementPercent));
    totalXp += xpForLevel;
  }

  return totalXp;
}

export function xpForNextLevel(currentLevel: number): number {
  return xpRequiredForLevel(currentLevel + 1);
}

export function xpNeededForNextLevel(currentLevel: number, currentXp: number): number {
  const xpForNext = xpRequiredForLevel(currentLevel + 1);
  const xpForCurrent = currentLevel > 1 ? xpRequiredForLevel(currentLevel) : 0;
  const xpProgress = currentXp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  return Math.max(0, xpNeeded - xpProgress);
}

export function getLevelProgress(currentLevel: number, currentXp: number): number {
  const xpForNext = xpRequiredForLevel(currentLevel + 1);
  const xpForCurrent = currentLevel > 1 ? xpRequiredForLevel(currentLevel) : 0;
  const xpProgress = currentXp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  if (xpNeeded === 0) return 1;
  return Math.min(1, Math.max(0, xpProgress / xpNeeded));
}

export function calculateRank(level: number): Rank {
  if (level <= 5) return RANKS[0];
  if (level <= 12) return RANKS[1];
  if (level <= 20) return RANKS[2];
  if (level <= 30) return RANKS[3];
  if (level <= 42) return RANKS[4];
  if (level <= 56) return RANKS[5];
  if (level <= 72) return RANKS[6];
  if (level <= 90) return RANKS[7];
  if (level <= 110) return RANKS[8];
  return RANKS[9];
}

/**
 * ✅ XP SOLO por ratings (no por publicar pregunta/respuesta)
 * Ajuste solicitado:
 * 1★ -> 0
 * 2★ -> 10
 * 3★ -> 25
 * 4★ -> 35
 * 5★ -> 50
 *
 * Nota importante:
 * En tus reglas Firestore de /reputation hay límite por operación: (newXp - oldXp) <= 60
 * Con este mapping el máximo es 50, así que NO se bloquea por reglas.
 */
export const XP_BY_STARS: Record<number, number> = {
  1: 0,
  2: 10,
  3: 25,
  4: 35,
  5: 50,
} as const;

export function getXpByStars(stars: number): number {
  return XP_BY_STARS[stars] ?? 0;
}

/**
 * ✅ Delta solo positivo:
 * - si el usuario sube el rating (ej 2★ -> 4★) suma diferencia
 * - si baja, NO resta (para evitar frustración/abuso)
 */
export function xpDelta(oldStars: number, newStars: number): number {
  const oldXp = getXpByStars(oldStars);
  const newXp = getXpByStars(newStars);
  return Math.max(0, newXp - oldXp);
}

export const XP_VALUES = {
  QUESTION_PUBLISHED: 0,
  ANSWER_PUBLISHED: 0,
  ANSWER_WELL_RATED: 0,   // legacy
  QUESTION_WELL_RATED: 0, // legacy
  TROPHY_OBTAINED: 100,
} as const;
