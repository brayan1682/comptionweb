# Verificación: rateAnswer y rateQuestion - Campos No Permitidos

## ✅ VERIFICACIÓN COMPLETA

### 1. rateAnswer (Líneas 646-726)

**Operaciones de escritura:**
- ✅ `setDoc(ratingRef, {...})` - Solo escribe en subcolección `questions/{qid}/answers/{aid}/ratings/{raterId}`
- ✅ NO actualiza `questions/{qid}/answers/{aid}` directamente
- ✅ NO actualiza `questions/{qid}` directamente
- ✅ NO actualiza campos `ratingAvg`, `ratingCount`, `ratingsByUserId` en documentos principales

**Campos calculados localmente (solo para retorno/notificaciones):**
- `ratingAvg` y `ratingCount` se calculan con `computeRatingStats()` solo para:
  - Retornar en el objeto Answer
  - Enviar en notificaciones
  - NO se escriben en Firestore

### 2. rateQuestion (Líneas 728-820)

**Operaciones de escritura:**
- ✅ `setDoc(ratingRef, {...})` - Solo escribe en subcolección `questions/{qid}/ratings/{raterId}`
- ✅ NO actualiza `questions/{qid}` directamente con campos de rating
- ✅ NO actualiza campos `ratingAvg`, `ratingCount`, `ratingsByUserId` en documento principal

**Campos calculados localmente (solo para retorno/notificaciones):**
- `ratingAvg` y `ratingCount` se calculan con `computeRatingStats()` solo para:
  - Retornar en el objeto Question
  - Enviar en notificaciones
  - NO se escriben en Firestore

### 3. Compatibilidad con Reglas de Firestore

**Reglas relevantes:**
```javascript
// QUESTIONS
match /questions/{questionId} {
  allow update: if isAuth() && (
    resource.data.authorId == uid()
    || isAdmin()
    || (
      isQuestionCounterUpdateOnly()  // Permite: answersCount, ratingAvg, ratingCount, viewsCount, updatedAt, viewedByUserId
      && isValidViewedByUpdate()
      && isViewsCountCoherent()
    )
  );
  
  // RATINGS en subcolección
  match /ratings/{raterId} {
    allow create, update: if isAuth()
      && raterId == uid()
      && get(/databases/$(database)/documents/questions/$(questionId)).data.authorId != uid()
      && isValidStarsDoc();
  }
}

// ANSWERS
match /answers/{answerId} {
  allow update: if isAuth() && (
    resource.data.authorId == uid()
    || isAdmin()
    || isAnswerCounterUpdateOnly()  // Permite: ratingAvg, ratingCount, updatedAt
  );
  
  // RATINGS en subcolección
  match /ratings/{raterId} {
    allow create, update: if isAuth()
      && raterId == uid()
      && get(/databases/$(database)/documents/questions/$(questionId)/answers/$(answerId)).data.authorId != uid()
      && isValidStarsDoc();
  }
}
```

**Análisis:**
- ✅ `rateAnswer` y `rateQuestion` solo escriben en subcolecciones `/ratings/{raterId}`
- ✅ NO intentan actualizar documentos principales con campos de rating
- ✅ Los stats se calculan on-demand al leer desde subcolecciones
- ✅ Compatible con todas las reglas de seguridad

### 4. Conclusión

**✅ VERIFICACIÓN EXITOSA:**
- No se actualizan campos no permitidos
- Solo se escriben en subcolecciones permitidas
- Los stats se calculan localmente y no se persisten
- Código compatible con reglas de Firestore

**Nota:** Si en el futuro se quiere optimizar consultas, se podría actualizar `ratingAvg` y `ratingCount` en documentos principales usando `isQuestionCounterUpdateOnly()` o `isAnswerCounterUpdateOnly()`, pero esto NO es necesario y el código actual es correcto.







