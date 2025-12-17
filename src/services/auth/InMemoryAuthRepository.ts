import type { User } from "../../domain/types";
import { ServiceError } from "../errors";
import { isEmail, newId, normalizeEmail, nowIso } from "../utils";
import type { AuthRepository, AuthStateListener, LoginInput, RegisterInput } from "./AuthRepository";

type StoredUser = User & { password: string };

export class InMemoryAuthRepository implements AuthRepository {
  private users: StoredUser[] = [];
  private currentUserId: string | null = null;
  private listeners = new Set<AuthStateListener>();

  getCurrentUser(): User | null {
    const u = this.users.find((x) => x.id === this.currentUserId);
    if (!u) return null;
    const { password: _pw, ...safe } = u;
    return safe;
  }

  getUserById(id: string): User | null {
    const u = this.users.find((x) => x.id === id);
    if (!u) return null;
    const { password: _pw, ...safe } = u;
    return safe;
  }

  onAuthStateChanged(listener: AuthStateListener) {
    this.listeners.add(listener);
    listener(this.getCurrentUser());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const user = this.getCurrentUser();
    this.listeners.forEach((l) => l(user));
  }

  async register(input: RegisterInput): Promise<User> {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const password = input.password;

    if (!name) throw new ServiceError("validation/invalid-argument", "El nombre es obligatorio");
    if (!isEmail(email)) throw new ServiceError("auth/invalid-email", "Email inválido");
    if (password.length < 8) throw new ServiceError("auth/weak-password", "La contraseña debe tener al menos 8 caracteres");

    const exists = this.users.some((u) => u.email === email);
    if (exists) throw new ServiceError("auth/email-already-in-use", "Este correo ya está en uso");

    const now = nowIso();
    const user: StoredUser = { id: newId(), name, email, role: "USER", createdAt: now, updatedAt: now, password };
    this.users.push(user);
    this.currentUserId = user.id;
    this.emit();
    const { password: _pw, ...safe } = user;
    return safe;
  }

  async login(input: LoginInput): Promise<User> {
    const email = normalizeEmail(input.email);
    const password = input.password;
    if (!isEmail(email)) throw new ServiceError("auth/invalid-email", "Email inválido");

    const user = this.users.find((u) => u.email === email);
    if (!user || user.password !== password) {
      throw new ServiceError("auth/invalid-credential", "Credenciales incorrectas");
    }
    this.currentUserId = user.id;
    this.emit();
    const { password: _pw, ...safe } = user;
    return safe;
  }

  async logout(): Promise<void> {
    this.currentUserId = null;
    this.emit();
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const me = this.users.find((x) => x.id === this.currentUserId);
    if (!me) throw new ServiceError("auth/not-authenticated", "No autenticado");
    const name = input.name.trim();
    if (!name) throw new ServiceError("validation/invalid-argument", "El nombre es obligatorio");
    me.name = name;
    me.updatedAt = nowIso();
    this.emit();
    const { password: _pw, ...safe } = me;
    return safe;
  }

  reset() {
    this.users = [];
    this.currentUserId = null;
    this.listeners.clear();
  }
}


