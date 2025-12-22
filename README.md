# Comption  
Aplicación web SPA de preguntas y respuestas orientada a tecnología

---

## Descripción del proyecto

**Comption** es una aplicación web tipo SPA (Single Page Application) orientada al intercambio de conocimiento en el área tecnológica.  
Permite a los usuarios registrarse, autenticarse, crear preguntas, responderlas y consultar contenido almacenado de forma persistente.

El proyecto está desarrollado con un enfoque técnico, priorizando la integración de módulos, la funcionalidad, la persistencia de datos y el despliegue en la nube, manteniendo un diseño visual básico.

---

## Estado actual

- Proyecto **funcional**
- Autenticación implementada con **Firebase Authentication**
- Base de datos **operativa y funcional** en **Firebase Firestore**
- Aplicación desplegada en **Vercel**
- Código fuente versionado en **GitHub**

---

## Objetivo

Desarrollar una aplicación web modular que integre frontend, autenticación, base de datos y despliegue, aplicando buenas prácticas de desarrollo de software y control de versiones.

---

## Tecnologías utilizadas

### Frontend
- React
- TypeScript
- Vite
- React Router
- Context API para manejo de sesión y estado global

### Backend y persistencia
- Firebase Authentication
- Firebase Firestore

### Infraestructura
- Git y GitHub (control de versiones)
- Vercel (despliegue en producción)

---

## Funcionalidades principales

- Registro de usuarios
- Inicio y cierre de sesión
- Persistencia de sesión
- Creación de preguntas
- Visualización de preguntas
- Visualización de preguntas por identificador
- Creación de respuestas
- Protección de rutas privadas

---

## Rutas de la aplicación

### Públicas
- `/` → Landing
- `/login`
- `/register`

### Privadas
- `/home`
- `/ask`
- `/question/:id`
- `/profile`
- `/help`

Las rutas privadas requieren una sesión activa para su acceso.

---

## Base de datos

El proyecto utiliza **Firebase Firestore** como base de datos NoSQL:

- Persistencia real de la información
- Acceso controlado mediante autenticación
- Reglas de seguridad configuradas en Firebase
- Uso de variables de entorno para proteger credenciales

---

## Seguridad

- Autenticación gestionada por Firebase Authentication
- Restricción de acceso a módulos privados
- Protección de datos mediante reglas de Firestore
- Credenciales no expuestas en el repositorio

---

## Ejecución en entorno local

### Requisitos
- Node.js (v18 o superior)
- npm

### Instalación y ejecución

```bash
npm install
npm run dev
Abrir en el navegador:
http://localhost:5173

Despliegue en producción
La aplicación está desplegada como SPA y es accesible públicamente.

URL del proyecto:
https://comptionweb.vercel.app/

Control de versiones
Git para control de versiones

GitHub como repositorio remoto

Repositorio del proyecto:
https://github.com/brayan1682/comptionweb.git

Alcance del proyecto
El diseño visual no es el foco principal del proyecto.
El énfasis está en:

Funcionalidad

Integración de módulos

Persistencia de datos

Seguridad

Despliegue en la nube

Uso académico
Este proyecto hace parte de evidencias académicas del SENA y demuestra competencias en:

Desarrollo de aplicaciones web

Integración de módulos de software

Uso de bases de datos en la nube

Control de versiones

Despliegue de aplicaciones web

Autor
Brayan Camilo Amaya Cucunubá
Proyecto académico – SENA