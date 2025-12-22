import type { AuthRepository, AuthStateListener, ChangePasswordInput, LoginInput, RegisterInput } from "./AuthRepository";
import { FirebaseAuthRepository } from "./FirebaseAuthRepository";

// Usando Firebase Auth y Firestore para autenticación.
class AuthService {
  private repo: AuthRepository;

  constructor(repo: AuthRepository) {
    this.repo = repo;
  }

  getCurrentUser() {
    return this.repo.getCurrentUser();
  }

  onAuthStateChanged(listener: AuthStateListener) {
    return this.repo.onAuthStateChanged(listener);
  }

  register(input: RegisterInput) {
    return this.repo.register(input);
  }

  login(input: LoginInput) {
    return this.repo.login(input);
  }

  logout() {
    return this.repo.logout();
  }

  updateProfile(input: { name: string }) {
    return this.repo.updateProfile(input);
  }

  changePassword(input: ChangePasswordInput) {
    return this.repo.changePassword(input);
  }

  getUserById(id: string) {
    return this.repo.getUserById(id);
  }

  refreshCurrentUser() {
    return this.repo.refreshCurrentUser();
  }
}

export const authService = new AuthService(new FirebaseAuthRepository());


