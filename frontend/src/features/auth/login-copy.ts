export const loginCopy = {
  es: {
    brand: {
      name: "CargoMesh",
      label: "Control tower",
    },
    brandPanel: {
      eyebrow: "Freight orchestration · WebMCP",
      title: "Tu red logística en una sola vista.",
      description:
        "Coordina cargas, capacidad y seguimiento internacional con decisiones visibles para todo el equipo.",
      capabilitiesLabel: "Capacidades de CargoMesh",
      capabilities: {
        requests: "Solicitudes centralizadas",
        operations: "Operación conectada",
        tracking: "Estado en tiempo real",
      },
      signal: "Entorno de demostración protegido",
    },
    form: {
      ariaLabel: "Inicio de sesión",
      eyebrow: "Acceso B2B",
      title: "Bienvenido a CargoMesh",
      intro: "Usa una cuenta autorizada para supervisar solicitudes y operaciones de carga.",
      securityLabel: "Acceso protegido",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "nombre@empresa.com",
      passwordLabel: "Contraseña",
      passwordPlaceholder: "Introduce tu contraseña",
      invalidCredentialsState: "Credenciales no válidas",
      recoverableState: "Error temporal",
      submit: "Iniciar sesión",
      loading: "Verificando acceso…",
    },
    footer: "CargoMesh · WebMCP Challenge 2026",
  },
  en: {
    brand: {
      name: "CargoMesh",
      label: "Control tower",
    },
    brandPanel: {
      eyebrow: "Freight orchestration · WebMCP",
      title: "Your logistics network in one view.",
      description:
        "Coordinate freight, capacity, and international tracking with decisions visible to your entire team.",
      capabilitiesLabel: "CargoMesh capabilities",
      capabilities: {
        requests: "Centralized requests",
        operations: "Connected operations",
        tracking: "Real-time status",
      },
      signal: "Protected demo environment",
    },
    form: {
      ariaLabel: "Sign in",
      eyebrow: "B2B access",
      title: "Welcome to CargoMesh",
      intro: "Use an authorized account to supervise freight requests and operations.",
      securityLabel: "Protected access",
      emailLabel: "Email address",
      emailPlaceholder: "name@company.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password",
      invalidCredentialsState: "Invalid credentials",
      recoverableState: "Temporary error",
      submit: "Sign in",
      loading: "Verifying access…",
    },
    footer: "CargoMesh · WebMCP Challenge 2026",
  },
} as const;

export const loginCopyEs = loginCopy.es;

export type LoginLocale = keyof typeof loginCopy;
