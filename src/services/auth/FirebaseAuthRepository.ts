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
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import type { User } from "../../domain/types";
import { ServiceError } from "../errors";
import { isEmail, normalizeEmail, nowIso } from "../utils";
import type { AuthRepository, AuthStateListener, ChangePasswordInput, LoginInput, RegisterInput } from "./AuthRepository";
import { auth, db } from "../../firebase/firebase";
import { publicProfilesService } from "../publicProfiles/publicProfilesService";

export class FirebaseAuthRepository implements AuthRepository {
  private listeners = new Set<AuthStateListener>();
  private unsubscribeFirebase: (() => void) | null = null;
  private unsubscribeFirestore: (() => void) | null = null;
  private currentUser: User | null = null;
  private isInitialized = false;

  constructor() {
    // Escuchar cambios de autenticación de Firebase
    this.unsubscribeFirebase = firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      // Limpiar listener anterior de Firestore
      if (this.unsubscribeFirestore) {
        this.unsubscribeFirestore();
        this.unsubscribeFirestore = null;
      }

      if (firebaseUser) {
        // ✅ FIX: Asegurar que users/{uid} exista en el primer login
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            // Crear el documento del usuario si no existe
            const now = nowIso();
            const userData = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
              displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
              email: firebaseUser.email || "",
              role: "USER" as const,
              level: 1,
              xp: 0,
              rank: "Novato",
              questionsCount: 0,
              answersCount: 0,
              savedCount: 0,
              followedCount: 0,
              avgRating: 0,
              createdAt: now,
              updatedAt: now,
            };
            
            await setDoc(userRef, userData, { merge: true });
            console.log("[FirebaseAuthRepository] ✓ Usuario creado en onAuthStateChanged:", firebaseUser.uid);
          }
        } catch (error: any) {
          console.warn("[FirebaseAuthRepository] No se pudo crear/verificar usuario en onAuthStateChanged:", error.message);
          // Continuar de todas formas
        }
        
        // ✅ REACTIVO: Usar onSnapshot sobre users/{userId} como única fuente de verdad
        const userRef = doc(db, "users", firebaseUser.uid);
        this.unsubscribeFirestore = onSnapshot(
          userRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              console.warn(`[FirebaseAuthRepository] Usuario ${firebaseUser.uid} no existe en Firestore`);
              this.currentUser = null;
              this.isInitialized = true;
              this.emit(null);
              return;
            }

            const data = snapshot.data();
            const now = nowIso();
            
            // Mapear datos de Firestore al tipo User
            const user: User = {
              id: firebaseUser.uid,
              name: data.name || data.displayName || firebaseUser.displayName || "",
              email: data.email || firebaseUser.email || "",
              role: data.role || "USER",
              level: data.level ?? 1,
              xp: data.xp ?? 0,
              rank: data.rank ?? "Novato",
              questionsCount: data.questionsCount ?? 0,
              answersCount: data.answersCount ?? 0,
              savedCount: data.savedCount ?? 0,
              followedCount: data.followedCount ?? 0,
              avgRating: data.avgRating ?? 0,
              createdAt: data.createdAt ? this.timestampToIso(data.createdAt) : now,
              updatedAt: data.updatedAt ? this.timestampToIso(data.updatedAt) : now,
            };

            this.currentUser = user;
            this.isInitialized = true;
            this.emit(user);

            // ✅ Sincronizar perfil público (no bloquea si falla)
            try {
              publicProfilesService.syncFromUser(firebaseUser.uid, {
                displayName: user.name || firebaseUser.displayName || "Usuario",
                photoURL: firebaseUser.photoURL || undefined,
                level: user.level || 1,
                rank: user.rank || "Novato",
                xp: user.xp || 0,
                questionsCount: user.questionsCount || 0,
                answersCount: user.answersCount || 0,
                avgRating: user.avgRating || 0,
              }).catch((syncError: any) => {
                console.warn(`[onSnapshot] No se pudo sincronizar perfil público (no bloquea): ${syncError.message || syncError.code || syncError}`);
              });
            } catch (syncError: any) {
              console.warn(`[onSnapshot] Error sincronizando perfil público (no bloquea): ${syncError.message || syncError}`);
            }
          },
          (error) => {
            console.error(`[FirebaseAuthRepository] Error en onSnapshot de users/${firebaseUser.uid}:`, error);
            // En caso de error, intentar cargar una vez con getDoc como fallback
            this.getUserFromFirestore(firebaseUser.uid).then((user) => {
              this.currentUser = user;
              this.isInitialized = true;
              this.emit(user);
            }).catch(() => {
              this.currentUser = null;
              this.isInitialized = true;
              this.emit(null);
            });
          }
        );
      } else {
        this.currentUser = null;
        this.isInitialized = true;
        this.emit(null);
      }
    });
  }

  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) return timestamp.toDate().toISOString();
    if (typeof timestamp === "string") return timestamp;
    return new Date().toISOString();
  }

  private async getUserFromFirestore(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (!userDoc.exists()) {
        return null;
      }
      const data = userDoc.data();
      const now = nowIso();
      
      // Asegurar que todos los campos obligatorios existan (compatibilidad con usuarios antiguos)
      const defaults = {
        level: 1,
        xp: 0,
        rank: "Novato",
        questionsCount: 0,
        answersCount: 0,
        savedCount: 0,
        followedCount: 0,
        avgRating: 0,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      };

      // Si faltan campos, actualizarlos en Firestore
      const needsUpdate = !data.level || !data.xp || !data.rank || 
                         data.questionsCount === undefined || 
                         data.answersCount === undefined ||
                         data.savedCount === undefined ||
                         data.followedCount === undefined ||
                         data.avgRating === undefined;

      if (needsUpdate) {
        try {
          await updateDoc(doc(db, "users", uid), {
            level: data.level ?? defaults.level,
            xp: data.xp ?? defaults.xp,
            rank: data.rank ?? defaults.rank,
            questionsCount: data.questionsCount ?? defaults.questionsCount,
            answersCount: data.answersCount ?? defaults.answersCount,
            savedCount: data.savedCount ?? defaults.savedCount,
            followedCount: data.followedCount ?? defaults.followedCount,
            avgRating: data.avgRating ?? defaults.avgRating,
            updatedAt: now,
          });
        } catch (updateError) {
          console.warn("No se pudieron actualizar campos faltantes del usuario:", updateError);
        }
      }

      return {
        id: uid,
        name: data.name || data.displayName || "",
        email: data.email || "",
        role: data.role || "USER",
        level: data.level ?? defaults.level,
        xp: data.xp ?? defaults.xp,
        rank: data.rank ?? defaults.rank,
        questionsCount: data.questionsCount ?? defaults.questionsCount,
        answersCount: data.answersCount ?? defaults.answersCount,
        savedCount: data.savedCount ?? defaults.savedCount,
        followedCount: data.followedCount ?? defaults.followedCount,
        avgRating: data.avgRating ?? defaults.avgRating,
        createdAt: data.createdAt ? this.timestampToIso(data.createdAt) : defaults.createdAt,
        updatedAt: data.updatedAt ? this.timestampToIso(data.updatedAt) : defaults.updatedAt,
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
    // Solo emitir estado actual si ya se inicializó Firebase Auth
    // Si no está inicializado, esperar a que Firebase Auth verifique el estado
    if (this.isInitialized) {
      listener(this.currentUser);
    }
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
        savedCount: 0,
        followedCount: 0,
        avgRating: 0,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userData);

      // Sincronizar perfil público (no bloquea si falla)
      try {
        await publicProfilesService.syncFromUser(firebaseUser.uid, {
          displayName: name,
          level: 1,
          rank: "Novato",
          xp: 0,
          questionsCount: 0,
          answersCount: 0,
          avgRating: 0,
        });
      } catch (syncError: any) {
        console.warn(`[register] No se pudo sincronizar perfil público (no bloquea): ${syncError.message || syncError}`);
      }

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

      // ✅ FIX: Obtener datos del usuario desde Firestore, o crearlo si no existe
      let user = await this.getUserFromFirestore(firebaseUser.uid);
      if (!user) {
        // Si no existe, crear el documento con valores por defecto
        const now = nowIso();
        const userData = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || email.split("@")[0],
          name: firebaseUser.displayName || email.split("@")[0],
          email: firebaseUser.email || email,
          role: "USER" as const,
          level: 1,
          xp: 0,
          rank: "Novato",
          questionsCount: 0,
          answersCount: 0,
          savedCount: 0,
          followedCount: 0,
          avgRating: 0,
          createdAt: now,
          updatedAt: now,
        };
        
        await setDoc(doc(db, "users", firebaseUser.uid), userData, { merge: true });
        
        user = {
          id: firebaseUser.uid,
          ...userData,
        };
      }

      this.currentUser = user;
      this.emit(user);

      // ✅ Sincronizar perfil público (no bloquea si falla)
      if (user) {
        try {
          await publicProfilesService.syncFromUser(firebaseUser.uid, {
            displayName: user.name || firebaseUser.displayName || email.split("@")[0],
            photoURL: firebaseUser.photoURL || undefined,
            level: user.level || 1,
            rank: user.rank || "Novato",
            xp: user.xp || 0,
            questionsCount: user.questionsCount || 0,
            answersCount: user.answersCount || 0,
            avgRating: user.avgRating || 0,
          });
        } catch (syncError: any) {
          console.warn(`[login] No se pudo sincronizar perfil público (no bloquea): ${syncError.message || syncError.code || syncError}`);
        }
      }

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
        displayName: name,
        updatedAt: now,
      });

      // Obtener usuario actualizado
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      if (!user) {
        throw new ServiceError("auth/not-authenticated", "Usuario no encontrado");
      }

      // Sincronizar perfil público (no bloquea si falla)
      try {
        await publicProfilesService.syncFromUser(firebaseUser.uid, {
          displayName: name,
          level: user.level || 1,
          rank: user.rank || "Novato",
          xp: user.xp || 0,
          questionsCount: user.questionsCount || 0,
          answersCount: user.answersCount || 0,
          avgRating: user.avgRating || 0,
        });
      } catch (syncError: any) {
        console.warn(`[updateProfile] No se pudo sincronizar perfil público (no bloquea): ${syncError.message || syncError}`);
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

  async refreshCurrentUser(): Promise<void> {
    // ✅ NO-OP: onSnapshot ya mantiene el estado actualizado automáticamente
    // Este método se mantiene por compatibilidad pero no hace nada
    // porque el listener de onSnapshot ya está activo
  }

  reset(): void {
    // Limpiar listeners
    this.listeners.clear();
    this.currentUser = null;
    if (this.unsubscribeFirebase) {
      this.unsubscribeFirebase();
      this.unsubscribeFirebase = null;
    }
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
  }
}

