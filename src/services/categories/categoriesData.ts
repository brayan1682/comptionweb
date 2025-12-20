// Categorías principales (obligatorias)
export const CATEGORIES = [
  "Frontend",
  "Backend",
  "Bases de datos",
  "Seguridad",
  "DevOps",
  "Mobile",
  "Errores y debugging",
  "Despliegue",
  "General"
] as const;

export type Category = (typeof CATEGORIES)[number];

// Tags predefinidos (sin creación libre por usuarios)
export const PREDEFINED_TAGS = [
  // Frontend
  "JavaScript",
  "TypeScript",
  "React",
  "Vue",
  "Angular",
  "HTML",
  "CSS",
  "SASS",
  "Tailwind",
  "Bootstrap",
  "Responsive",
  "PWA",
  "Frontend",
  // Backend
  "Node.js",
  "Python",
  "Java",
  "C#",
  "PHP",
  "Backend",
  "API",
  "REST",
  "GraphQL",
  "WebSocket",
  // Cloud
  "AWS",
  "Azure",
  "Cloud",
  "Firebase",
  // Auth
  "Autenticación",
  "Auth",
  "JWT",
  // Rendimiento
  "Performance",
  "Optimización",
  "Rendimiento",
  // Seguridad
  "Seguridad",
  "Criptografía",
  "HTTPS",
  // Bases de datos
  "SQL",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "Redis",
  "Bases de datos",
  // DevOps
  "Docker",
  "Kubernetes",
  "Git",
  "CI/CD",
  "DevOps",
  // Mobile
  "iOS",
  "Android",
  "React Native",
  "Flutter",
  "Mobile",
  // Testing
  "Testing",
  "Jest",
  "Unit Testing",
  // Otros
  "SEO",
  "Accesibilidad",
  "Arquitectura",
  "Clean Code",
  "Design Patterns",
  "Algoritmos",
  "Estructuras de datos",
  "Debugging",
  "Errores"
] as const;

export type Tag = (typeof PREDEFINED_TAGS)[number];

