import type { AuthRepository, AuthStateListener, LoginInput, RegisterInput } from "./AuthRepository";
import { InMemoryAuthRepository } from "./InMemoryAuthRepository";

// Listo para reemplazar por un repositorio Firebase (sin tocar componentes).
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

  getUserById(id: string) {
    return this.repo.getUserById(id);
  }
}

export const authService = new AuthService(new InMemoryAuthRepository());


