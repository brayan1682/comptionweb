// Categorías principales (obligatorias)
export const CATEGORIES = [
  "Frontend",
  "Backend",
  "Bases de datos",
  "Desarrollo móvil",
  "DevOps",
  "Seguridad"
] as const;

export type Category = (typeof CATEGORIES)[number];

// Tags predefinidos (sin creación libre por usuarios)
export const PREDEFINED_TAGS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Vue",
  "Angular",
  "Node.js",
  "Python",
  "Java",
  "C#",
  "PHP",
  "SQL",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "Git",
  "CI/CD",
  "Testing",
  "API",
  "REST",
  "GraphQL",
  "WebSocket",
  "HTML",
  "CSS",
  "SASS",
  "Tailwind",
  "Bootstrap",
  "Responsive",
  "PWA",
  "iOS",
  "Android",
  "React Native",
  "Flutter",
  "Firebase",
  "Autenticación",
  "Seguridad",
  "Performance",
  "SEO",
  "Accesibilidad",
  "Arquitectura",
  "Clean Code",
  "Design Patterns",
  "Algoritmos",
  "Estructuras de datos"
] as const;

export type Tag = (typeof PREDEFINED_TAGS)[number];

