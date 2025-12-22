import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CATEGORIES, PREDEFINED_TAGS } from "../services/categories/categoriesData";

/**
 * Inicializa las colecciones de categorías y tags en Firestore
 * Este script debe ejecutarse una vez para poblar las colecciones iniciales
 */
export async function initializeFirestore() {
  try {
    // Inicializar categorías
    const categoriesRef = collection(db, "categories");
    for (const category of CATEGORIES) {
      const categoryDoc = doc(categoriesRef, category);
      const categorySnap = await getDoc(categoryDoc);
      
      if (!categorySnap.exists()) {
        await setDoc(categoryDoc, {
          id: category,
          name: category,
          createdAt: new Date().toISOString(),
        });
        console.log(`Categoría creada: ${category}`);
      }
    }

    // Inicializar tags
    const tagsRef = collection(db, "tags");
    for (const tag of PREDEFINED_TAGS) {
      const tagDoc = doc(tagsRef, tag);
      const tagSnap = await getDoc(tagDoc);
      
      if (!tagSnap.exists()) {
        await setDoc(tagDoc, {
          id: tag,
          name: tag,
          createdAt: new Date().toISOString(),
        });
        console.log(`Tag creado: ${tag}`);
      }
    }

    console.log("Firestore inicializado correctamente");
  } catch (error) {
    console.error("Error inicializando Firestore:", error);
    throw error;
  }
}




