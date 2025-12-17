import type { User } from "../../domain/types";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthStateListener = (user: User | null) => void;

export interface AuthRepository {
  getCurrentUser(): User | null;
  onAuthStateChanged(listener: AuthStateListener): () => void;
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  updateProfile(input: { name: string }): Promise<User>;
  getUserById(id: string): User | null;
  reset(): void;
}


