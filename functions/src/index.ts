import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// Importar utilidades
import { calculateLevel, calculateRank, getXpByStars } from "./utils/reputationUtils";

/**
 * Trigger: onCreate en questions/{questionId}/ratings/{raterId}
 * 
 * Cuando un usuario califica una pregunta:
 * 1. Leer stars del rating
 * 2. Sumar XP al autor de la pregunta según mapping (1->0, 2->10, 3->25, 4->35, 5->50)
 * 3. Actualizar users/{authorId}: xp, level, rank
 * 4. Actualizar publicProfiles/{authorId} con los mismos campos (si existe o crearlo)
 * 5. Marcar el rating como procesado (processedAt o processed=true) para evitar doble otorgamiento
 */
export const onQuestionRatingCreated = functions.firestore
  .document("questions/{questionId}/ratings/{raterId}")
  .onCreate(async (snap, context) => {
    const ratingData = snap.data();
    const questionId = context.params.questionId;
    const raterId = context.params.raterId;

    // Verificar si ya fue procesado (idempotencia)
    if (ratingData.processed === true || ratingData.processedAt) {
      console.log(`[onQuestionRatingCreated] Rating ya procesado: questions/${questionId}/ratings/${raterId}`);
      return null;
    }

    const stars = ratingData.stars;
    if (!stars || typeof stars !== "number" || stars < 1 || stars > 5) {
      console.error(`[onQuestionRatingCreated] Stars inválido: ${stars}`);
      return null;
    }

    try {
      // Obtener la pregunta para obtener el authorId
      const questionRef = db.doc(`questions/${questionId}`);
      const questionSnap = await questionRef.get();

      if (!questionSnap.exists) {
        console.error(`[onQuestionRatingCreated] Pregunta no encontrada: ${questionId}`);
        return null;
      }

      const questionData = questionSnap.data();
      const authorId = questionData?.authorId;

      if (!authorId) {
        console.error(`[onQuestionRatingCreated] authorId no encontrado en pregunta: ${questionId}`);
        return null;
      }

      // No otorgar XP si el autor se califica a sí mismo (aunque las reglas ya lo previenen)
      if (authorId === raterId) {
        console.log(`[onQuestionRatingCreated] El autor se calificó a sí mismo, omitiendo XP`);
        // Marcar como procesado de todas formas
        await snap.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Calcular XP a otorgar
      const xpToAdd = getXpByStars(stars);

      if (xpToAdd === 0) {
        console.log(`[onQuestionRatingCreated] Stars=${stars} otorga 0 XP, omitiendo actualización`);
        // Marcar como procesado de todas formas
        await snap.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // ✅ FIX 1: Usar transacción para actualizar users/{authorId} y publicProfiles/{authorId} de forma consistente
      await db.runTransaction(async (transaction) => {
        // Leer users/{authorId} y publicProfiles/{authorId} ANTES de escribir
        const userRef = db.doc(`users/${authorId}`);
        const publicProfileRef = db.doc(`publicProfiles/${authorId}`);
        
        const userSnap = await transaction.get(userRef);
        const publicProfileSnap = await transaction.get(publicProfileRef);

        // Obtener XP actual de cualquiera de los dos documentos
        let currentXp = 0;
        if (userSnap.exists) {
          currentXp = Number(userSnap.data()?.xp || 0);
        } else if (publicProfileSnap.exists) {
          currentXp = Number(publicProfileSnap.data()?.xp || 0);
        }

        const newXp = Math.max(0, currentXp + xpToAdd);
        const newLevel = calculateLevel(newXp);
        const newRank = calculateRank(newLevel);

        const now = admin.firestore.Timestamp.now();

        // Actualizar /users/{authorId}
        if (userSnap.exists) {
          transaction.update(userRef, {
            xp: newXp,
            level: newLevel,
            rank: newRank,
            updatedAt: now,
          });
        } else {
          // Crear documento si no existe
          transaction.set(userRef, {
            uid: authorId,
            xp: newXp,
            level: newLevel,
            rank: newRank,
            questionsCount: 0,
            answersCount: 0,
            savedCount: 0,
            followedCount: 0,
            avgRating: 0,
            name: "",
            displayName: "",
            email: "",
            role: "USER",
            createdAt: now,
            updatedAt: now,
          });
        }

        // Actualizar /publicProfiles/{authorId}
        if (publicProfileSnap.exists) {
          transaction.update(publicProfileRef, {
            xp: newXp,
            level: newLevel,
            rank: newRank,
            updatedAt: now,
          });
        } else {
          // Crear documento si no existe
          transaction.set(publicProfileRef, {
            userId: authorId,
            uid: authorId,
            xp: newXp,
            level: newLevel,
            rank: newRank,
            trophiesCount: 0,
            questionsCount: 0,
            answersCount: 0,
            avgRating: 0,
            displayName: "",
            createdAt: now,
            updatedAt: now,
          }, { merge: true });
        }

        // Marcar rating como procesado
        transaction.update(snap.ref, {
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`[onQuestionRatingCreated] XP otorgado: ${xpToAdd} XP a usuario ${authorId} por rating de ${stars} estrellas`);
    } catch (error) {
      console.error(`[onQuestionRatingCreated] Error procesando rating:`, error);
      throw error;
    }

    return null;
  });

/**
 * Trigger: onCreate en questions/{questionId}/answers/{answerId}/ratings/{raterId}
 * 
 * Cuando un usuario califica una respuesta:
 * 1. Leer stars del rating
 * 2. NO otorgar XP por ratings de respuestas (solo por trofeos)
 * 3. Mantener agregados en answers/{answerId}: ratingSum, ratingCount, ratingAvg (transactional)
 * 4. Recalcular el trofeo del question:
 *    - Elegir la respuesta con mayor ratingAvg, si empate mayor ratingCount, si empate la más antigua
 *    - Si cambia el ganador: actualizar questions/{questionId}.trophyAnswerId
 *    - Actualizar trophiesCount del nuevo ganador (increment)
 *    - Y del anterior ganador (decrement) si existía
 * 5. XP por trofeo: Otorgar 100 XP al ganar por primera vez o cada vez que se convierte en ganador
 * 6. Marcar el rating como procesado
 */
export const onAnswerRatingCreated = functions.firestore
  .document("questions/{questionId}/answers/{answerId}/ratings/{raterId}")
  .onCreate(async (snap, context) => {
    const ratingData = snap.data();
    const questionId = context.params.questionId;
    const answerId = context.params.answerId;
    const raterId = context.params.raterId;

    // Verificar si ya fue procesado (idempotencia)
    // ✅ NOTE: Client now grants XP in same transaction, so this function should skip XP grant to avoid duplication
    // This function still handles trophy calculation and marking as processed
    if (ratingData.processed === true || ratingData.processedAt) {
      console.log(`[onAnswerRatingCreated] Rating ya procesado: questions/${questionId}/answers/${answerId}/ratings/${raterId}`);
      return null;
    }

    const stars = ratingData.stars || ratingData.value;
    if (!stars || typeof stars !== "number" || stars < 1 || stars > 5) {
      console.error(`[onAnswerRatingCreated] Stars inválido: ${stars}`);
      return null;
    }

    try {
      // Obtener la respuesta para obtener el authorId
      const answerRef = db.doc(`questions/${questionId}/answers/${answerId}`);
      const answerSnap = await answerRef.get();

      if (!answerSnap.exists) {
        console.error(`[onAnswerRatingCreated] Respuesta no encontrada: ${answerId}`);
        return null;
      }

      const answerData = answerSnap.data();
      const authorId = answerData?.authorId;

      if (!authorId) {
        console.error(`[onAnswerRatingCreated] authorId no encontrado en respuesta: ${answerId}`);
        return null;
      }

      // No otorgar XP si el autor se califica a sí mismo
      if (authorId === raterId) {
        console.log(`[onAnswerRatingCreated] El autor se calificó a sí mismo, omitiendo XP`);
        // Marcar como procesado de todas formas
        await snap.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Calcular XP a otorgar
      const xpToAdd = getXpByStars(stars);

      // Obtener todas las respuestas ANTES de la transacción para saber qué documentos leer
      const answersSnapshot = await db
        .collection(`questions/${questionId}/answers`)
        .get();

      const answerIds = answersSnapshot.docs.map((doc) => doc.id);

      // Usar transacción para:
      // 1. Actualizar agregados de rating en la respuesta
      // 2. Actualizar reputation del autor
      // 3. Recalcular trofeo
      // 4. Marcar como procesado
      await db.runTransaction(async (transaction) => {
        // 1. Actualizar agregados de rating en la respuesta
        // Leer la respuesta actualizada dentro de la transacción para obtener los valores más recientes
        const currentAnswerSnap = await transaction.get(answerRef);
        if (!currentAnswerSnap.exists) {
          throw new Error(`Respuesta ${answerId} no encontrada en transacción`);
        }

        const currentAnswerData = currentAnswerSnap.data();
        const currentRatingSum = currentAnswerData?.ratingSum || 0;
        const currentRatingCount = currentAnswerData?.ratingCount || 0;

        const newRatingSum = currentRatingSum + stars;
        const newRatingCount = currentRatingCount + 1;
        const newRatingAvg = Math.round((newRatingSum / newRatingCount) * 10) / 10;

        transaction.update(answerRef, {
          ratingSum: newRatingSum,
          ratingCount: newRatingCount,
          ratingAvg: newRatingAvg,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. ✅ XP is now granted by client in same transaction (rateAnswer)
        // This function only handles trophy calculation and marking as processed
        // XP grant is skipped here to avoid duplication

        // 3. Recalcular trofeo
        const questionRef = db.doc(`questions/${questionId}`);
        const questionSnap = await transaction.get(questionRef);

        if (!questionSnap.exists) {
          console.error(`[onAnswerRatingCreated] Pregunta no encontrada: ${questionId}`);
          return;
        }

        // Leer todas las respuestas dentro de la transacción para obtener datos actualizados
        // (incluyendo la que acabamos de actualizar)
        const answerSnaps: admin.firestore.DocumentSnapshot[] = [];
        for (const id of answerIds) {
          const snap = await transaction.get(db.doc(`questions/${questionId}/answers/${id}`));
          answerSnaps.push(snap);
        }

        // Encontrar la mejor respuesta según criterios:
        // 1. Mayor ratingAvg
        // 2. Si empate, mayor ratingCount
        // 3. Si empate, la más antigua (menor createdAt)
        let bestAnswer: { id: string; ratingAvg: number; ratingCount: number; createdAt: admin.firestore.Timestamp } | null = null;

        for (const answerSnap of answerSnaps) {
          if (!answerSnap.exists) continue;

          const answerData = answerSnap.data();
          const ratingAvg = answerData?.ratingAvg || 0;
          const ratingCount = answerData?.ratingCount || 0;
          const createdAt = answerData?.createdAt || admin.firestore.Timestamp.now();

          // Mínimo 3 calificaciones para ser elegible (según requisitos)
          if (ratingCount < 3) {
            continue;
          }

          if (!bestAnswer) {
            bestAnswer = {
              id: answerSnap.id,
              ratingAvg,
              ratingCount,
              createdAt,
            };
            continue;
          }

          // Comparar: mayor ratingAvg primero
          if (ratingAvg > bestAnswer.ratingAvg) {
            bestAnswer = {
              id: answerSnap.id,
              ratingAvg,
              ratingCount,
              createdAt,
            };
          } else if (ratingAvg === bestAnswer.ratingAvg) {
            // Si empate en ratingAvg, comparar ratingCount
            if (ratingCount > bestAnswer.ratingCount) {
              bestAnswer = {
                id: answerSnap.id,
                ratingAvg,
                ratingCount,
                createdAt,
              };
            } else if (ratingCount === bestAnswer.ratingCount) {
              // Si empate en ratingCount, elegir la más antigua
              if (createdAt.toMillis() < bestAnswer.createdAt.toMillis()) {
                bestAnswer = {
                  id: answerSnap.id,
                  ratingAvg,
                  ratingCount,
                  createdAt,
                };
              }
            }
          }
        }

        const currentTrophyAnswerId = questionSnap.data()?.trophyAnswerId || null;
        const newTrophyAnswerId = bestAnswer ? bestAnswer.id : null;

        // Si cambió el ganador del trofeo
        if (currentTrophyAnswerId !== newTrophyAnswerId) {
          // Decrementar trophiesCount del anterior ganador (si existía)
          if (currentTrophyAnswerId) {
            const previousAnswerSnap = await transaction.get(
              db.doc(`questions/${questionId}/answers/${currentTrophyAnswerId}`)
            );
            if (previousAnswerSnap.exists) {
              const previousAuthorId = previousAnswerSnap.data()?.authorId;
              if (previousAuthorId) {
                // ✅ ISSUE 3 FIX: Update users/{authorId} instead of reputation/{authorId}
                const previousUserRef = db.doc(`users/${previousAuthorId}`);
                const previousUserSnap = await transaction.get(previousUserRef);
                if (previousUserSnap.exists) {
                  const currentTrophies = previousUserSnap.data()?.trophiesCount || 0;
                  transaction.update(previousUserRef, {
                    trophiesCount: Math.max(0, currentTrophies - 1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                }

                // Actualizar publicProfiles del anterior ganador
                const previousPublicProfileRef = db.doc(`publicProfiles/${previousAuthorId}`);
                const previousPublicProfileSnap = await transaction.get(previousPublicProfileRef);
                if (previousPublicProfileSnap.exists) {
                  const updateData: any = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  };
                  const existingData = previousPublicProfileSnap.data();
                  if (existingData?.trophiesCount !== undefined) {
                    const currentTrophies = existingData.trophiesCount || 0;
                    updateData.trophiesCount = Math.max(0, currentTrophies - 1);
                  }
                  transaction.update(previousPublicProfileRef, updateData);
                }
              }
            }
          }

          // Incrementar trophiesCount del nuevo ganador (si existe)
          if (newTrophyAnswerId) {
            const newAnswerSnap = await transaction.get(
              db.doc(`questions/${questionId}/answers/${newTrophyAnswerId}`)
            );
            if (newAnswerSnap.exists) {
              const newAuthorId = newAnswerSnap.data()?.authorId;
              if (newAuthorId) {
                // ✅ ISSUE 3 FIX: Update users/{authorId} instead of reputation/{authorId}
                const newUserRef = db.doc(`users/${newAuthorId}`);
                const newUserSnap = await transaction.get(newUserRef);

                let currentTrophies = 0;
                if (newUserSnap.exists) {
                  currentTrophies = newUserSnap.data()?.trophiesCount || 0;
                }

                const newTrophies = currentTrophies + 1;
                const now = admin.firestore.Timestamp.now();

                // ESTRATEGIA DE XP POR TROFEO:
                // Otorgar 100 XP cada vez que un usuario se convierte en ganador del trofeo
                // (no restamos XP al perderlo, solo otorgamos al ganarlo)
                const trophyXp = 100;

                // Obtener XP actual
                let currentXp = 0;
                if (newUserSnap.exists) {
                  currentXp = Number(newUserSnap.data()?.xp || 0);
                }

                const newXp = Math.max(0, currentXp + trophyXp);
                const newLevel = calculateLevel(newXp);
                const newRank = calculateRank(newLevel);

                if (newUserSnap.exists) {
                  transaction.update(newUserRef, {
                    xp: newXp,
                    level: newLevel,
                    rank: newRank,
                    trophiesCount: newTrophies,
                    updatedAt: now,
                  });
                } else {
                  transaction.set(newUserRef, {
                    uid: newAuthorId,
                    xp: newXp,
                    level: newLevel,
                    rank: newRank,
                    trophiesCount: newTrophies,
                    questionsCount: 0,
                    answersCount: 0,
                    savedCount: 0,
                    followedCount: 0,
                    avgRating: 0,
                    name: "",
                    displayName: "",
                    email: "",
                    role: "USER",
                    createdAt: now,
                    updatedAt: now,
                  });
                }

                // Actualizar publicProfiles del nuevo ganador (usar mismo XP calculado arriba)
                const newPublicProfileRef = db.doc(`publicProfiles/${newAuthorId}`);
                const newPublicProfileSnap = await transaction.get(newPublicProfileRef);

                if (newPublicProfileSnap.exists) {
                  transaction.update(newPublicProfileRef, {
                    xp: newXp,
                    level: newLevel,
                    rank: newRank,
                    trophiesCount: newTrophies,
                    updatedAt: now,
                  });
                } else {
                  transaction.set(newPublicProfileRef, {
                    userId: newAuthorId,
                    xp: newXp,
                    level: newLevel,
                    rank: newRank,
                    trophiesCount: newTrophies,
                    updatedAt: now,
                  }, { merge: true });
                }
              }
            }

            // Actualizar questions/{questionId}.trophyAnswerId
            transaction.update(questionRef, {
              trophyAnswerId: newTrophyAnswerId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[onAnswerRatingCreated] Trofeo otorgado a respuesta ${newTrophyAnswerId} (anterior: ${currentTrophyAnswerId || "ninguno"})`);
          } else {
            // No hay ganador (todas las respuestas tienen menos de 3 calificaciones)
            transaction.update(questionRef, {
              trophyAnswerId: null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        // 4. Marcar rating como procesado
        transaction.update(snap.ref, {
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`[onAnswerRatingCreated] Rating procesado: ${stars} estrellas para respuesta ${answerId}`);
    } catch (error) {
      console.error(`[onAnswerRatingCreated] Error procesando rating:`, error);
      throw error;
    }

    return null;
  });

