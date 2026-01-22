/**
 * Normaliza un nombre de tag para usarlo como ID de documento en Firestore.
 * Los IDs de documentos no pueden contener "/", por lo que los reemplazamos con "-".
 * 
 * Ejemplos:
 * - "CI/CD" -> "ci-cd"
 * - "Unit Testing" -> "unit-testing"
 * - "React Native" -> "react-native"
 */
export function normalizeTagId(tagName: string): string {
  return tagName
    .toLowerCase()
    .replace(/\//g, "-")  // Reemplazar "/" con "-"
    .replace(/\s+/g, "-")  // Reemplazar espacios con "-"
    .replace(/[^a-z0-9-]/g, "") // Eliminar caracteres especiales excepto "-"
    .replace(/-+/g, "-")   // Reemplazar múltiples "-" con uno solo
    .replace(/^-|-$/g, ""); // Eliminar "-" al inicio o final
}

/**
 * Obtiene el nombre original de un tag desde su ID normalizado.
 * Como no podemos recuperar el nombre original directamente desde el ID,
 * necesitamos mantener un mapeo o buscar en la colección de tags.
 * 
 * Por ahora, esta función intenta revertir la normalización básica,
 * pero para casos como "CI/CD" necesitamos buscar en Firestore.
 */
export function denormalizeTagId(normalizedId: string): string {
  // Revertir la normalización básica
  return normalizedId
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

