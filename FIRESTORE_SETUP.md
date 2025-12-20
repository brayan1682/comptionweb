# Configuración de Firestore para Comption

## 📋 Resumen

Este documento describe la configuración completa de Firestore para el proyecto Comption, incluyendo la estructura de colecciones, reglas de seguridad y procedimientos de inicialización.

## 🗂️ Estructura de Colecciones

### 1. `users`
Documentos de usuarios con la siguiente estructura:
- `uid` (string): ID del usuario (mismo que el ID del documento)
- `displayName` (string): Nombre para mostrar
- `name` (string): Nombre del usuario
- `email` (string): Email del usuario
- `role` (string): "USER" | "EXPERT" | "ADMIN"
- `level` (number): Nivel del usuario
- `xp` (number): Experiencia acumulada
- `rank` (string): Rango actual
- `questionsCount` (number): Contador de preguntas
- `answersCount` (number): Contador de respuestas
- `avgRating` (number): Calificación promedio
- `createdAt` (timestamp): Fecha de creación
- `updatedAt` (timestamp): Fecha de última actualización

### 2. `questions`
Colección de preguntas con subcolección `answers`:
- `title` (string): Título de la pregunta
- `description` (string): Descripción/contenido
- `authorId` (string): ID del autor
- `authorName` (string): Nombre del autor (denormalizado)
- `isAnonymous` (boolean): Si es anónima
- `category` (string): Categoría principal
- `tags` (array): Array de etiquetas (1-5)
- `ratingAvg` (number): Promedio de calificaciones
- `ratingCount` (number): Número de calificaciones
- `answersCount` (number): Número de respuestas
- `viewsCount` (number): Número de vistas únicas
- `viewedByUserId` (map): Mapa de usuarios que han visto
- `ratingsByUserId` (map): Mapa de calificaciones por usuario
- `trophyAnswerId` (string | null): ID de la respuesta con trofeo
- `status` (string): "active" | "reported" | "deleted"
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Subcolección `answers`:**
- `questionId` (string): ID de la pregunta padre
- `content` (string): Contenido de la respuesta
- `authorId` (string): ID del autor
- `authorName` (string): Nombre del autor
- `isAnonymous` (boolean)
- `ratingAvg` (number)
- `ratingCount` (number)
- `ratingsByUserId` (map)
- `hasTrophy` (boolean)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### 3. `categories`
Categorías predefinidas:
- `id` (string): ID de la categoría
- `name` (string): Nombre de la categoría
- `createdAt` (timestamp)

### 4. `tags`
Etiquetas predefinidas:
- `id` (string): ID de la etiqueta
- `name` (string): Nombre de la etiqueta
- `createdAt` (timestamp)

### 5. `reports`
Reportes de contenido:
- `reporterId` (string): ID del usuario que reporta
- `targetType` (string): "question" | "answer"
- `targetId` (string): ID del contenido reportado
- `questionId` (string | null): ID de la pregunta (si es respuesta)
- `reason` (string): Razón del reporte
- `description` (string): Descripción adicional
- `status` (string): "pending" | "reviewed" | "resolved" | "dismissed"
- `reviewedBy` (string | null): ID del admin que revisó
- `reviewedAt` (timestamp | null)
- `createdAt` (timestamp)

### 6. `notifications`
Notificaciones de usuarios:
- `userId` (string): ID del usuario destinatario
- `type` (string): Tipo de notificación
- `data` (map): Datos de la notificación
- `readAt` (timestamp | null)
- `createdAt` (timestamp)

### 7. `reputation`
Reputación de usuarios:
- `userId` (string)
- `xp` (number)
- `level` (number)
- `rank` (string)
- `trophiesCount` (number)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### 8. `savedQuestions`
Preguntas guardadas por usuarios:
- `userId` (string)
- `questionId` (string)
- `savedAt` (timestamp)

### 9. `followedQuestions`
Preguntas seguidas por usuarios:
- `userId` (string)
- `questionId` (string)
- `followedAt` (timestamp)

## 🔒 Reglas de Seguridad

Las reglas de seguridad están definidas en `firestore.rules`. Para desplegarlas:

### Opción 1: Firebase CLI
```bash
firebase deploy --only firestore:rules
```

### Opción 2: Firebase Console
1. Ve a Firebase Console → Firestore Database → Rules
2. Copia el contenido de `firestore.rules`
3. Pega en el editor de reglas
4. Publica las reglas

## 🚀 Inicialización

### Categorías y Tags
Las categorías y tags se inicializan automáticamente cuando la aplicación se carga por primera vez mediante `initializeFirestore()` en `src/firebase/initFirestore.ts`.

Si necesitas inicializarlas manualmente, puedes ejecutar:
```typescript
import { initializeFirestore } from "./firebase/initFirestore";
initializeFirestore();
```

### Categorías Disponibles
- Frontend
- Backend
- Bases de datos
- Seguridad
- DevOps
- Mobile
- Errores y debugging
- Despliegue
- General

### Tags Disponibles
Ver `src/services/categories/categoriesData.ts` para la lista completa de tags predefinidos.

## ✅ Verificación

Para verificar que todo funciona correctamente:

1. **Registro de usuario**: Al registrarse, se crea automáticamente un documento en `users` con todos los campos requeridos.

2. **Crear pregunta**: Al crear una pregunta, se guarda en `questions` con todos los campos necesarios.

3. **Crear respuesta**: Las respuestas se guardan en la subcolección `answers` de cada pregunta.

4. **Categorías y Tags**: Se inicializan automáticamente al cargar la app.

## 📝 Notas Importantes

- Todas las escrituras se realizan desde el código del frontend
- Las reglas de seguridad protegen los datos según los permisos definidos
- Los contadores (questionsCount, answersCount, etc.) se actualizan automáticamente
- El sistema de reputación se actualiza cuando se realizan acciones (XP, nivel, rango)

## 🔧 Troubleshooting

Si encuentras problemas:

1. Verifica que las reglas de Firestore estén desplegadas correctamente
2. Revisa la consola del navegador para errores de Firebase
3. Asegúrate de que las variables de entorno de Firebase estén configuradas
4. Verifica que el usuario tenga los permisos necesarios según las reglas




