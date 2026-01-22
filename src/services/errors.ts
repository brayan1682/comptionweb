export type ServiceErrorCode =
  | "auth/email-already-in-use"
  | "auth/invalid-credential"
  | "auth/weak-password"
  | "auth/invalid-email"
  | "auth/not-authenticated"
  | "permission-denied"
  | "questions/not-found"
  | "questions/create-failed"
  | "questions/read-failed"
  | "questions/verify-failed"
  | "questions/convert-failed"
  | "questions/id-mismatch"
  | "answers/create-failed"
  | "answers/update-failed"
  | "answers/delete-failed"
  | "questions/update-failed"
  | "questions/delete-failed"
  | "ratings/create-failed"
  | "ratings/read-failed"
  | "replies/create-failed"
  | "replies/delete-failed"
  | "questions/sync-failed"
  | "validation/invalid-argument";

export class ServiceError extends Error {
  code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}



