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
      intro: "Entra al entorno técnico con la cuenta demo autorizada, sin escribir credenciales.",
      securityLabel: "Acceso protegido",
      demoNotice: "La identidad demo se resuelve en el servidor y conserva Supabase Auth, membresía ACTIVE y RLS.",
      unauthorizedState: "Acceso no autorizado",
      unauthorizedMessage: "La cuenta demo no tiene una membresía ACTIVE válida.",
      unavailableMessage: "El acceso demo no está configurado en este despliegue.",
      recoverableMessage: "No pudimos iniciar la sesión demo. Inténtalo nuevamente.",
      recoverableState: "Error temporal",
      submit: "Entrar a CargoMesh",
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
      intro: "Enter the technical demo with the authorized demo account—no credentials required.",
      securityLabel: "Protected access",
      demoNotice: "The demo identity is resolved server-side while preserving Supabase Auth, ACTIVE membership, and RLS.",
      unauthorizedState: "Unauthorized access",
      unauthorizedMessage: "The demo account does not have a valid ACTIVE membership.",
      unavailableMessage: "Demo access is not configured for this deployment.",
      recoverableMessage: "We could not start the demo session. Please try again.",
      recoverableState: "Temporary error",
      submit: "Enter CargoMesh",
      loading: "Verifying access…",
    },
    footer: "CargoMesh · WebMCP Challenge 2026",
  },
} as const;

export const loginCopyEs = loginCopy.es;

export type LoginLocale = keyof typeof loginCopy;
export type LoginFormCopy = (typeof loginCopy)[LoginLocale]["form"];
