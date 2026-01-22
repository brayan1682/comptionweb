# Instrucciones de Despliegue - Cloud Functions

Este documento contiene las instrucciones para desplegar las Cloud Functions que manejan el sistema de XP y trofeos.

## Requisitos Previos

1. **Firebase CLI instalado**: Si no lo tienes, instálalo con:
   ```bash
   npm install -g firebase-tools
   ```

2. **Autenticación en Firebase**: Asegúrate de estar autenticado:
   ```bash
   firebase login
   ```

3. **Proyecto Firebase configurado**: Asegúrate de que tu proyecto Firebase esté configurado correctamente.

## Pasos de Despliegue

### 1. Inicializar Firebase Functions (si es la primera vez)

Si es la primera vez que despliegas functions en este proyecto:

```bash
firebase init functions
```

Cuando se te pregunte:
- **¿Qué lenguaje quieres usar?** → Selecciona **TypeScript**
- **¿Quieres usar ESLint?** → Sí (recomendado)
- **¿Quieres instalar dependencias ahora?** → Sí

### 2. Instalar Dependencias

Navega a la carpeta `functions` e instala las dependencias:

```bash
cd functions
npm install
cd ..
```

### 3. Compilar TypeScript

Compila el código TypeScript a JavaScript:

```bash
cd functions
npm run build
cd ..
```

### 4. Desplegar Functions

Despliega solo las functions (sin afectar otras partes del proyecto):

```bash
firebase deploy --only functions
```

O si quieres desplegar todo (functions, firestore rules, etc.):

```bash
firebase deploy
```

### 5. Verificar el Despliegue

Después del despliegue, puedes verificar que las functions estén activas:

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Functions** en el menú lateral
4. Deberías ver dos functions:
   - `onQuestionRatingCreated`
   - `onAnswerRatingCreated`

## Estructura de las Functions

Las functions implementadas son:

### `onQuestionRatingCreated`
- **Trigger**: `questions/{questionId}/ratings/{raterId}` onCreate
- **Función**: Otorga XP al autor de la pregunta cuando recibe una calificación
- **XP otorgada**: Según el mapping (1★→0, 2★→10, 3★→25, 4★→35, 5★→50)

### `onAnswerRatingCreated`
- **Trigger**: `questions/{questionId}/answers/{answerId}/ratings/{raterId}` onCreate
- **Función**: 
  - Otorga XP al autor de la respuesta
  - Actualiza agregados de rating (ratingSum, ratingCount, ratingAvg)
  - Recalcula y otorga trofeos a la mejor respuesta
  - Otorga 100 XP adicionales cuando se gana un trofeo

## Verificación Post-Despliegue

### Probar las Functions

1. **Crear una pregunta** en tu aplicación
2. **Calificar la pregunta** con otro usuario
3. **Verificar** que el autor recibió XP en `reputation/{authorId}`
4. **Crear una respuesta** a la pregunta
5. **Calificar la respuesta** (al menos 3 veces con diferentes usuarios)
6. **Verificar** que:
   - El autor de la respuesta recibió XP
   - Se actualizaron los agregados en `answers/{answerId}`
   - Se otorgó el trofeo en `questions/{questionId}.trophyAnswerId`
   - El ganador recibió 100 XP adicionales por el trofeo

### Ver Logs

Para ver los logs de las functions en tiempo real:

```bash
firebase functions:log
```

O ver logs específicos de una function:

```bash
firebase functions:log --only onQuestionRatingCreated
firebase functions:log --only onAnswerRatingCreated
```

## Solución de Problemas

### Error: "Functions did not deploy"

- Verifica que tengas Node.js 20 instalado
- Verifica que las dependencias estén instaladas correctamente
- Revisa los logs de compilación para errores de TypeScript

### Error: "Permission denied"

- Asegúrate de tener permisos de administrador en el proyecto Firebase
- Verifica que estés autenticado: `firebase login`

### Las functions no se ejecutan

- Verifica que las reglas de Firestore permitan la creación de ratings
- Revisa los logs de las functions para ver errores
- Verifica que el rating tenga el campo `stars` correctamente

### XP no se otorga

- Verifica que el rating tenga `processed: false` o no tenga `processedAt`
- Revisa los logs de las functions
- Verifica que el `authorId` de la pregunta/respuesta sea válido

## Notas Importantes

1. **Idempotencia**: Las functions están diseñadas para ser idempotentes. Si un rating ya fue procesado (tiene `processed: true` o `processedAt`), no se procesará nuevamente.

2. **Transacciones**: Las actualizaciones se realizan en transacciones para garantizar consistencia.

3. **XP por Trofeo**: Se otorgan 100 XP cada vez que un usuario se convierte en ganador del trofeo. Si pierde el trofeo, no se resta XP.

4. **Criterios de Trofeo**: 
   - Mínimo 3 calificaciones
   - Mayor ratingAvg
   - Si empate, mayor ratingCount
   - Si empate, la respuesta más antigua

## Actualización de Functions

Si necesitas actualizar las functions después de hacer cambios:

1. Modifica el código en `functions/src/`
2. Compila: `cd functions && npm run build && cd ..`
3. Despliega: `firebase deploy --only functions`

## Desarrollo Local

Para probar las functions localmente antes de desplegar:

```bash
cd functions
npm run serve
```

Esto iniciará el emulador de Firebase Functions localmente.



