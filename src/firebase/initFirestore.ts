import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Inicializa las colecciones de categorías y tags en Firestore
 * ✅ FIX: Solo LEE categorías/tags (no intenta crearlas desde cliente)
 * Si no existen o hay permission-denied, usa defaults locales en memoria
 * ✅ No reintenta infinitamente - solo intenta una vez por colección
 */
export async function initializeFirestore() {
  // ✅ FIX: Solo verificar que existan, NO intentar crearlas desde cliente
  // Las reglas prohíben write en categories/tags desde cliente
  const categoriesRef = collection(db, "categories");
  const tagsRef = collection(db, "tags");
  
  // Intentar leer algunas categorías/tags para verificar conectividad
  // ✅ No reintenta - si falla, usa defaults locales
  try {
    const categoriesSnapshot = await getDocs(categoriesRef);
    console.log(`[initFirestore] ✓ Categorías encontradas en Firestore: ${categoriesSnapshot.size}`);
  } catch (error: any) {
    const errorCode = error?.code || "unknown";
    const errorMessage = error?.message || String(error);
    const path = "categories";
    console.warn(`[initFirestore] ⚠️ No se pudieron leer categorías (path: ${path}): ${errorCode} - ${errorMessage}`);
    console.warn(`[initFirestore] → Usando defaults locales para categorías`);
    // ✅ No lanzar error - la app puede funcionar con defaults locales
  }

  try {
    const tagsSnapshot = await getDocs(tagsRef);
    console.log(`[initFirestore] ✓ Tags encontrados en Firestore: ${tagsSnapshot.size}`);
  } catch (error: any) {
    const errorCode = error?.code || "unknown";
    const errorMessage = error?.message || String(error);
    const path = "tags";
    console.warn(`[initFirestore] ⚠️ No se pudieron leer tags (path: ${path}): ${errorCode} - ${errorMessage}`);
    console.warn(`[initFirestore] → Usando defaults locales para tags`);
    // ✅ No lanzar error - la app puede funcionar con defaults locales
  }

  console.log("[initFirestore] ✓ Inicialización completada (usando defaults locales si no existen en Firestore)");
  // ✅ No hay try/catch externo - cada operación maneja su propio error
}
