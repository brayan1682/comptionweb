# Comption (React + backend simulado, Firebase-ready)

## Objetivo
App SPA de preguntas y respuestas orientada a tecnología.

- **React + TypeScript**
- **React Router**
- **Context API** para estado global (sesión + preguntas)
- **Arquitectura orientada a servicios/repositories** (simula backend)
- Lista para reemplazar “in-memory” por **Firebase Auth** y **Firestore** sin tocar componentes.

> Regla del proyecto: **sin CSS / sin librerías UI / sin diseño visual**. Solo funcionalidad, estructura y navegación.

## Ejecutar en local

```bash
npm install
npm run dev
```

Abrir: `http://localhost:5173`

## Rutas

### Públicas
- `/` Landing
- `/login`
- `/register`

### Privadas (protegidas)
- `/home`
- `/ask`
- `/question/:id`
- `/profile`
- `/help`

## Estructura (alto nivel)

- `src/services/**`: **backend simulado** (sin componentes aquí)
  - `src/services/auth/*`: auth tipo Firebase (register/login/logout + onAuthStateChanged)
  - `src/services/questions/*`: preguntas/respuestas tipo Firestore (create/list/get/addAnswer)
- `src/app/providers/**`: Context Providers (estado global)
- `src/routes/**`: guards de rutas (`ProtectedRoute`, `PublicOnlyRoute`)
- `src/layouts/**`: layout privado (navbar en vistas privadas)
- `src/pages/**`: pantallas (solo UI/inputs + llamadas al contexto)

## Preparación para Firebase (cómo se reemplaza)

- Cambiar `InMemoryAuthRepository` por un `FirebaseAuthRepository`.
- Cambiar `InMemoryQuestionsRepository` por un `FirestoreQuestionsRepository`.

Los componentes **no cambian**: solo cambias la implementación del repositorio usado por `authService` y `questionsService`.

## Vercel (SPA)
Incluye `vercel.json` con rewrite a `index.html` para que React Router funcione en producción.

## Cambios/correcciones vs versión anterior
- **Doble scroll**: al no usar CSS global ni hacks de overflow, queda un único scroll natural del navegador.
- **Contraseña con “??”**: inputs de password sin placeholders raros ni scripts; ahora solo `type="password"` y placeholder `********`.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
