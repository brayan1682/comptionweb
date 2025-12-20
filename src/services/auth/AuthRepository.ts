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

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export interface AuthRepository {
  getCurrentUser(): User | null;
  onAuthStateChanged(listener: AuthStateListener): () => void;
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  updateProfile(input: { name: string }): Promise<User>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  getUserById(id: string): User | null;
  reset(): void;
}


