// Importar funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase usando variables de entorno (Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios principales
export const auth = getAuth(app);
export const db = getFirestore(app);

// Verificar configuración
if (!db.app.options.projectId) {
  console.warn("[Firebase] ⚠️ ProjectId no configurado. Verifica las variables de entorno.");
}