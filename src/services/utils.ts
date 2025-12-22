export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  // Firestore usa ids tipo string; esto lo simula bien.
  return crypto.randomUUID();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}



