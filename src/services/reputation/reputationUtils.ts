// Sistema de rangos (10 rangos motivadores)
export const RANKS = [
  "Novato",        // Niveles 1-5
  "Aprendiz",      // Niveles 6-12
  "Colaborador",   // Niveles 13-20
  "Contribuyente", // Niveles 21-30
  "Explorador",    // Niveles 31-42
  "Analista",      // Niveles 43-56
  "Mentor",        // Niveles 57-72
  "Especialista",  // Niveles 73-90
  "Referente",     // Niveles 91-110
  "Leyenda"        // Nivel 111+
] as const;

export type Rank = (typeof RANKS)[number];

// Cálculo de nivel basado en XP (crecimiento progresivo balanceado)
// Nivel 1 → 0-99 XP
// Nivel 2 → 100 XP
// Cada nivel incrementa entre 10% y 15% el XP requerido
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  
  let level = 1;
  let totalXpNeeded = 0;
  let xpForCurrentLevel = 100;
  
  while (totalXpNeeded + xpForCurrentLevel <= xp) {
    totalXpNeeded += xpForCurrentLevel;
    level++;
    // Incremento progresivo: 10% base + 0.5% por nivel (máximo 15%)
    const incrementPercent = Math.min(0.10 + (level - 2) * 0.005, 0.15);
    xpForCurrentLevel = Math.floor(xpForCurrentLevel * (1 + incrementPercent));
  }
  
  return level;
}

// XP requerido para alcanzar un nivel específico (XP total acumulado)
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

// XP para el siguiente nivel
export function xpForNextLevel(currentLevel: number): number {
  return xpRequiredForLevel(currentLevel + 1);
}

// XP necesario para subir del nivel actual al siguiente
export function xpNeededForNextLevel(currentLevel: number, currentXp: number): number {
  const xpForNext = xpRequiredForLevel(currentLevel + 1);
  const xpForCurrent = currentLevel > 1 ? xpRequiredForLevel(currentLevel) : 0;
  const xpProgress = currentXp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  return Math.max(0, xpNeeded - xpProgress);
}

// Obtener el progreso actual dentro del nivel (0-1)
export function getLevelProgress(currentLevel: number, currentXp: number): number {
  const xpForNext = xpRequiredForLevel(currentLevel + 1);
  const xpForCurrent = currentLevel > 1 ? xpRequiredForLevel(currentLevel) : 0;
  const xpProgress = currentXp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  if (xpNeeded === 0) return 1;
  return Math.min(1, Math.max(0, xpProgress / xpNeeded));
}

// Determinar rango basado en nivel (10 rangos)
export function calculateRank(level: number): Rank {
  if (level <= 5) return RANKS[0];      // Novato
  if (level <= 12) return RANKS[1];   // Aprendiz
  if (level <= 20) return RANKS[2];   // Colaborador
  if (level <= 30) return RANKS[3];   // Contribuyente
  if (level <= 42) return RANKS[4];   // Explorador
  if (level <= 56) return RANKS[5];   // Analista
  if (level <= 72) return RANKS[6];   // Mentor
  if (level <= 90) return RANKS[7];   // Especialista
  if (level <= 110) return RANKS[8];  // Referente
  return RANKS[9];                     // Leyenda (nivel 111+)
}

// Valores de XP por acción
export const XP_VALUES = {
  QUESTION_PUBLISHED: 10, // XP por crear pregunta
  ANSWER_PUBLISHED: 5, // XP bajo
  ANSWER_WELL_RATED: 15, // XP medio (cuando recibe rating >= 4)
  QUESTION_WELL_RATED: 15, // XP medio (cuando recibe rating >= 4)
  TROPHY_OBTAINED: 50 // XP alto (la mayor recompensa)
} as const;

