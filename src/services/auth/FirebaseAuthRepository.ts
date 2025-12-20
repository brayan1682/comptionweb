import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc
} from "firebase/firestore";
import type { User } from "../../domain/types";
import { ServiceError } from "../errors";
import { isEmail, normalizeEmail, nowIso } from "../utils";
import type { AuthRepository, AuthStateListener, ChangePasswordInput, LoginInput, RegisterInput } from "./AuthRepository";
import { auth, db } from "../../firebase/firebase";

export class FirebaseAuthRepository implements AuthRepository {
  private listeners = new Set<AuthStateListener>();
  private unsubscribeFirebase: (() => void) | null = null;
  private currentUser: User | null = null;

  constructor() {
    // Escuchar cambios de autenticación de Firebase
    this.unsubscribeFirebase = firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Obtener datos del usuario desde Firestore
        const user = await this.getUserFromFirestore(firebaseUser.uid);
        this.currentUser = user;
        this.emit(user);
      } else {
        this.currentUser = null;
        this.emit(null);
      }
    });
  }

  private async getUserFromFirestore(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (!userDoc.exists()) {
        return null;
      }
      const data = userDoc.data();
      return {
        id: uid,
        name: data.name,
        email: data.email,
        role: data.role || "USER",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      console.error("Error obteniendo usuario de Firestore:", error);
      return null;
    }
  }

  private emit(user: User | null) {
    this.listeners.forEach((listener) => listener(user));
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  onAuthStateChanged(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    // Emitir estado actual inmediatamente (usando el usuario cacheado si está disponible)
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  async register(input: RegisterInput): Promise<User> {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const password = input.password;

    // Validaciones
    if (!name) {
      throw new ServiceError("validation/invalid-argument", "El nombre es obligatorio");
    }
    if (!isEmail(email)) {
      throw new ServiceError("auth/invalid-email", "Email inválido");
    }
    if (password.length < 8) {
      throw new ServiceError("auth/weak-password", "La contraseña debe tener al menos 8 caracteres");
    }

    try {
      // Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Actualizar el perfil de Firebase Auth con el nombre
      await firebaseUpdateProfile(firebaseUser, {
        displayName: name,
      });

      // Crear documento en Firestore con información adicional completa
      const now = nowIso();
      const userData = {
        uid: firebaseUser.uid,
        displayName: name,
        name, // Mantener compatibilidad con el tipo User
        email,
        role: "USER" as const,
        level: 1,
        xp: 0,
        rank: "Novato",
        questionsCount: 0,
        answersCount: 0,
        avgRating: 0,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userData);

      // Retornar el usuario creado
      const newUser: User = {
        id: firebaseUser.uid,
        ...userData,
      };
      this.currentUser = newUser;
      this.emit(newUser);
      return newUser;
    } catch (error: any) {
      console.error("Error en registro Firebase:", error);
      
      // Mapear errores de Firebase a ServiceError
      if (error.code === "auth/email-already-in-use") {
        throw new ServiceError("auth/email-already-in-use", "Este correo ya está en uso");
      }
      if (error.code === "auth/invalid-email") {
        throw new ServiceError("auth/invalid-email", "Email inválido");
      }
      if (error.code === "auth/weak-password") {
        throw new ServiceError("auth/weak-password", "La contraseña debe tener al menos 8 caracteres");
      }
      
      // Error genérico
      throw new ServiceError("auth/invalid-email", "No se pudo crear la cuenta");
    }
  }

  async login(input: LoginInput): Promise<User> {
    const email = normalizeEmail(input.email);
    const password = input.password;

    if (!isEmail(email)) {
      throw new ServiceError("auth/invalid-email", "Email inválido");
    }

    try {
      // Iniciar sesión con Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Obtener datos del usuario desde Firestore
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      if (!user) {
        throw new ServiceError("auth/invalid-credential", "Usuario no encontrado");
      }

      this.currentUser = user;
      this.emit(user);
      return user;
    } catch (error: any) {
      console.error("Error en login Firebase:", error);
      
      // Mapear errores de Firebase a ServiceError
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        throw new ServiceError("auth/invalid-credential", "Credenciales incorrectas");
      }
      if (error.code === "auth/invalid-email") {
        throw new ServiceError("auth/invalid-email", "Email inválido");
      }
      
      // Error genérico
      throw new ServiceError("auth/invalid-credential", "Credenciales incorrectas");
    }
  }

  async logout(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error en logout Firebase:", error);
      throw new ServiceError("auth/not-authenticated", "Error al cerrar sesión");
    }
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new ServiceError("auth/not-authenticated", "No autenticado");
    }

    const name = input.name.trim();
    if (!name) {
      throw new ServiceError("validation/invalid-argument", "El nombre es obligatorio");
    }

    try {
      // Actualizar perfil en Firebase Auth
      await firebaseUpdateProfile(firebaseUser, {
        displayName: name,
      });

      // Actualizar en Firestore
      const now = nowIso();
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name,
        updatedAt: now,
      });

      // Obtener usuario actualizado
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      if (!user) {
        throw new ServiceError("auth/not-authenticated", "Usuario no encontrado");
      }

      this.currentUser = user;
      this.emit(user);
      return user;
    } catch (error) {
      console.error("Error actualizando perfil Firebase:", error);
      throw new ServiceError("validation/invalid-argument", "No se pudo actualizar el perfil");
    }
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      throw new ServiceError("auth/not-authenticated", "No autenticado");
    }

    const { currentPassword, newPassword } = input;

    if (newPassword.length < 8) {
      throw new ServiceError("auth/weak-password", "La nueva contraseña debe tener al menos 8 caracteres");
    }

    try {
      // Reautenticar al usuario
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Cambiar la contraseña
      await updatePassword(firebaseUser, newPassword);
    } catch (error: any) {
      console.error("Error cambiando contraseña:", error);
      
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        throw new ServiceError("auth/invalid-credential", "La contraseña actual es incorrecta");
      }
      if (error.code === "auth/weak-password") {
        throw new ServiceError("auth/weak-password", "La nueva contraseña debe tener al menos 8 caracteres");
      }
      if (error.code === "auth/requires-recent-login") {
        throw new ServiceError("auth/not-authenticated", "Tu sesión ha expirado. Por favor, inicia sesión nuevamente");
      }
      
      throw new ServiceError("auth/invalid-credential", "No se pudo cambiar la contraseña");
    }
  }

  getUserById(_id: string): User | null {
    // Esta función es síncrona según la interfaz, pero necesitamos datos de Firestore
    // Por ahora retornamos null y confiamos en que se use onAuthStateChanged o se haga una llamada asíncrona
    // En una implementación completa, esto podría cachear usuarios o hacer una llamada síncrona
    return null;
  }

  reset(): void {
    // Limpiar listeners
    this.listeners.clear();
    this.currentUser = null;
    if (this.unsubscribeFirebase) {
      this.unsubscribeFirebase();
      this.unsubscribeFirebase = null;
    }
  }
}

