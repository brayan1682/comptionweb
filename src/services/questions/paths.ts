/**
 * Constantes centralizadas de paths de Firestore para preguntas y respuestas.
 * 
 * Source of truth único para evitar inconsistencias en las rutas.
 * 
 * IMPORTANTE: Las respuestas se guardan en SUBCOLECCIÓN:
 * /questions/{questionId}/answers/{answerId}
 * 
 * NO en colección raíz /answers
 */
export const FIRESTORE_PATHS = {
  /**
   * Colección de preguntas
   * Path: /questions
   */
  QUESTIONS: "questions",
  
  /**
   * Documento de pregunta
   * Path: /questions/{questionId}
   */
  question: (questionId: string) => `questions/${questionId}`,
  
  /**
   * Subcolección de respuestas de una pregunta
   * Path: /questions/{questionId}/answers
   */
  answers: (questionId: string) => `questions/${questionId}/answers`,
  
  /**
   * Documento de respuesta (subcolección)
   * Path: /questions/{questionId}/answers/{answerId}
   */
  answer: (questionId: string, answerId: string) => `questions/${questionId}/answers/${answerId}`,
} as const;
