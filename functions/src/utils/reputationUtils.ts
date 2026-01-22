/**
 * Utilidades para calcular nivel y rango basado en XP
 * Replica la lógica del frontend (src/services/reputation/reputationUtils.ts)
 */

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

/**
 * Calcula el nivel basado en XP total
 */
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

/**
 * Calcula el rango basado en el nivel
 */
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
 * Mapping de estrellas a XP según requisitos:
 * 1★ -> 0 XP
 * 2★ -> 10 XP
 * 3★ -> 25 XP
 * 4★ -> 35 XP
 * 5★ -> 50 XP
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



