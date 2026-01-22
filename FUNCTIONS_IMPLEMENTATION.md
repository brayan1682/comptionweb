# Implementación de Cloud Functions - Sistema de XP y Trofeos

## Resumen

Se han implementado Cloud Functions para Firebase que manejan automáticamente el sistema de XP y trofeos cuando los usuarios califican preguntas y respuestas.

## Funciones Implementadas

### 1. `onQuestionRatingCreated`

**Trigger**: `questions/{questionId}/ratings/{raterId}` onCreate

**Funcionalidad**:
- Lee el campo `stars` del rating creado
- Calcula XP a otorgar según el mapping: 1★→0, 2★→10, 3★→25, 4★→35, 5★→50
- Actualiza `reputation/{authorId}` con:
  - `xp`: suma el XP calculado
  - `level`: recalcula usando `calculateLevel(xp)`
  - `rank`: recalcula usando `calculateRank(level)`
- Actualiza `publicProfiles/{authorId}` con los mismos campos (si existe o lo crea)
- Actualiza `users/{authorId}` si existe y tiene campos de reputación
- Marca el rating como procesado (`processed: true`, `processedAt: timestamp`) para evitar doble otorgamiento

**Idempotencia**: Verifica `processed` o `processedAt` antes de procesar

### 2. `onAnswerRatingCreated`

**Trigger**: `questions/{questionId}/answers/{answerId}/ratings/{raterId}` onCreate

**Funcionalidad**:
- Lee el campo `stars` del rating creado
- Calcula XP a otorgar según el mapping
- Actualiza agregados en `answers/{answerId}`:
  - `ratingSum`: suma el nuevo rating
  - `ratingCount`: incrementa en 1
  - `ratingAvg`: recalcula (ratingSum / ratingCount)
- Actualiza `reputation/{authorId}`, `publicProfiles/{authorId}`, y `users/{authorId}` (si aplica)
- Recalcula el trofeo de la pregunta:
  - Obtiene todas las respuestas de la pregunta
  - Encuentra la mejor respuesta según:
    1. Mayor `ratingAvg`
    2. Si empate, mayor `ratingCount`
    3. Si empate, la más antigua (menor `createdAt`)
  - Requiere mínimo 3 calificaciones para ser elegible
  - Si cambia el ganador:
    - Actualiza `questions/{questionId}.trophyAnswerId`
    - Decrementa `trophiesCount` del anterior ganador (si existía)
    - Incrementa `trophiesCount` del nuevo ganador
    - Otorga 100 XP al nuevo ganador (cada vez que se convierte en ganador)
- Marca el rating como procesado

**Estrategia de XP por Trofeo**:
- Se otorgan 100 XP cada vez que un usuario se convierte en ganador del trofeo
- NO se resta XP al perder el trofeo (solo se decrementa `trophiesCount`)
- Esto está documentado en comentarios en el código

**Idempotencia**: Verifica `processed` o `processedAt` antes de procesar

## Cambios en el Frontend

### 1. `src/pages/HelpPage.tsx`

- **Eliminada** la sección "Actualización de calificación" que explicaba cómo funcionaban las actualizaciones
- **Reemplazada** por una sección que indica que solo se puede calificar una vez
- **Actualizada** la sección de reglas para reflejar que no se pueden actualizar calificaciones

### 2. `src/services/questions/FirestoreQuestionsRepository.ts`

**Método `rateAnswer`**:
- Ahora verifica si el rating ya existe antes de crear
- Si existe, lanza error: "Ya has calificado esta respuesta. Solo se puede calificar una vez."
- Eliminada la lógica de actualización

**Método `rateQuestion`**:
- Ahora verifica si el rating ya existe antes de crear
- Si existe, lanza error: "Ya has calificado esta pregunta. Solo se puede calificar una vez."
- Eliminada la lógica de actualización

## Estructura de Archivos

```
functions/
├── package.json          # Dependencias y scripts
├── tsconfig.json         # Configuración TypeScript
├── .eslintrc.js         # Configuración ESLint
└── src/
    ├── index.ts         # Funciones principales
    └── utils/
        └── reputationUtils.ts  # Utilidades de cálculo de nivel/rango
```

## Utilidades Replicadas

Las funciones `calculateLevel` y `calculateRank` del frontend (`src/services/reputation/reputationUtils.ts`) han sido replicadas en `functions/src/utils/reputationUtils.ts` para mantener consistencia.

## Transacciones

Todas las actualizaciones se realizan dentro de transacciones de Firestore para garantizar:
- Consistencia de datos
- Atomicidad de operaciones
- Prevención de condiciones de carrera

## Seguridad

- Las functions usan Admin SDK, por lo que bypassan las reglas de Firestore
- Se valida que el autor no se califique a sí mismo (aunque las reglas ya lo previenen)
- Se valida que `stars` esté en el rango 1-5

## Próximos Pasos

1. Desplegar las functions siguiendo las instrucciones en `DEPLOY_FUNCTIONS.md`
2. Probar el flujo completo:
   - Crear pregunta
   - Calificar pregunta (verificar XP)
   - Crear respuesta
   - Calificar respuesta múltiples veces (verificar XP y trofeos)
3. Monitorear logs para verificar que todo funcione correctamente



