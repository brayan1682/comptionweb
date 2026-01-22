export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  // Firestore usa ids tipo string; esto lo simula bien.
  return crypto.randomUUID();
}

/**
 * Formatea una fecha ISO string a formato legible con fecha y hora (es-CO)
 * Ejemplo: "29 dic 2025, 9:15 p. m."
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Fecha inválida";
    }
    return date.toLocaleString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (error) {
    return "Fecha inválida";
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}



