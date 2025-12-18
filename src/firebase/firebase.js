// Importar funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";         // Para autenticación
import { getFirestore } from "firebase/firestore"; // Para base de datos

// Configuración de Firebase de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyCMeyxmsPdSRrp4_xk69-Ftzce2UQbTOf8",
  authDomain: "comption-3d81f.firebaseapp.com",
  projectId: "comption-3d81f",
  storageBucket: "comption-3d81f.appspot.com",
  messagingSenderId: "205529814226",
  appId: "1:205529814226:web:03304ded14a841348a890b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios específicos
const auth = getAuth(app); // Autenticación
const db = getFirestore(app); // Firestore

// Exportar para usar en otras partes del proyecto
export { auth, db };
