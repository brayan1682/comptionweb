export type ServiceErrorCode =
  | "auth/email-already-in-use"
  | "auth/invalid-credential"
  | "auth/weak-password"
  | "auth/invalid-email"
  | "auth/not-authenticated"
  | "questions/not-found"
  | "validation/invalid-argument";

export class ServiceError extends Error {
  code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}



