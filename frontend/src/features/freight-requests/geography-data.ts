export type LogisticsHub = {
  city: string;
  display: string;
  tag?: string;
};

export type LogisticsRegion = {
  name: string;
  hubs: LogisticsHub[];
};

export type CountryLogistics = {
  code: "PE" | "CL" | "CO" | "BO" | "AR" | "EC";
  name: string;
  dialCode: string;
  flag: string;
  regions: LogisticsRegion[];
};

export const LATAM_LOGISTICS_DIRECTORY: CountryLogistics[] = [
  {
    code: "PE",
    name: "Perú",
    dialCode: "+51",
    flag: "🇵🇪",
    regions: [
      {
        name: "Callao",
        hubs: [
          { city: "Callao", display: "Callao" },
          { city: "Ventanilla", display: "Ventanilla" },
          { city: "Bellavista", display: "Bellavista" },
        ],
      },
      {
        name: "Lima",
        hubs: [
          { city: "Lima", display: "Lima" },
          { city: "Lurín", display: "Lurín" },
          { city: "Huachipa", display: "Huachipa" },
          { city: "Punta Hermosa", display: "Punta Hermosa" },
          { city: "Ate", display: "Ate" },
        ],
      },
      {
        name: "Arequipa",
        hubs: [
          { city: "Arequipa", display: "Arequipa" },
          { city: "Matarani", display: "Matarani" },
          { city: "Mollendo", display: "Mollendo" },
        ],
      },
      {
        name: "Moquegua",
        hubs: [
          { city: "Ilo", display: "Ilo" },
          { city: "Moquegua", display: "Moquegua" },
        ],
      },
      {
        name: "Tacna",
        hubs: [
          { city: "Tacna", display: "Tacna" },
          { city: "Santa Rosa", display: "Santa Rosa" },
        ],
      },
      {
        name: "Piura",
        hubs: [
          { city: "Paita", display: "Paita" },
          { city: "Piura", display: "Piura" },
        ],
      },
      {
        name: "La Libertad",
        hubs: [
          { city: "Trujillo", display: "Trujillo" },
          { city: "Salaverry", display: "Salaverry" },
        ],
      },
    ],
  },
  {
    code: "CL",
    name: "Chile",
    dialCode: "+56",
    flag: "🇨🇱",
    regions: [
      {
        name: "Región Metropolitana",
        hubs: [
          { city: "Santiago", display: "Santiago" },
          { city: "San Bernardo", display: "San Bernardo" },
          { city: "Pudahuel", display: "Pudahuel" },
          { city: "Quilicura", display: "Quilicura" },
        ],
      },
      {
        name: "Valparaíso",
        hubs: [
          { city: "Valparaíso", display: "Valparaíso" },
          { city: "San Antonio", display: "San Antonio" },
          { city: "Los Andes", display: "Los Andes" },
        ],
      },
      {
        name: "Antofagasta",
        hubs: [
          { city: "Antofagasta", display: "Antofagasta" },
          { city: "Calama", display: "Calama" },
          { city: "Mejillones", display: "Mejillones" },
        ],
      },
      {
        name: "Tarapacá",
        hubs: [
          { city: "Iquique", display: "Iquique" },
          { city: "Alto Hospicio", display: "Alto Hospicio" },
        ],
      },
      {
        name: "Arica y Parinacota",
        hubs: [
          { city: "Arica", display: "Arica" },
          { city: "Chacalluta", display: "Chacalluta" },
        ],
      },
    ],
  },
  {
    code: "CO",
    name: "Colombia",
    dialCode: "+57",
    flag: "🇨🇴",
    regions: [
      {
        name: "Cundinamarca",
        hubs: [
          { city: "Bogotá", display: "Bogotá" },
          { city: "Funza", display: "Funza" },
        ],
      },
      {
        name: "Valle del Cauca",
        hubs: [
          { city: "Buenaventura", display: "Buenaventura" },
          { city: "Cali", display: "Cali" },
        ],
      },
      {
        name: "Antioquia",
        hubs: [
          { city: "Medellín", display: "Medellín" },
          { city: "Rionegro", display: "Rionegro" },
        ],
      },
      {
        name: "Nariño",
        hubs: [
          { city: "Ipiales", display: "Ipiales" },
          { city: "Pasto", display: "Pasto" },
        ],
      },
      {
        name: "Atlántico",
        hubs: [
          { city: "Barranquilla", display: "Barranquilla" },
        ],
      },
    ],
  },
  {
    code: "BO",
    name: "Bolivia",
    dialCode: "+591",
    flag: "🇧🇴",
    regions: [
      {
        name: "La Paz",
        hubs: [
          { city: "La Paz", display: "La Paz" },
          { city: "El Alto", display: "El Alto" },
          { city: "Desaguadero", display: "Desaguadero" },
        ],
      },
      {
        name: "Santa Cruz",
        hubs: [
          { city: "Santa Cruz de la Sierra", display: "Santa Cruz de la Sierra" },
          { city: "Montero", display: "Montero" },
        ],
      },
      {
        name: "Cochabamba",
        hubs: [
          { city: "Cochabamba", display: "Cochabamba" },
        ],
      },
      {
        name: "Oruro",
        hubs: [
          { city: "Oruro", display: "Oruro" },
        ],
      },
    ],
  },
  {
    code: "AR",
    name: "Argentina",
    dialCode: "+54",
    flag: "🇦🇷",
    regions: [
      {
        name: "Buenos Aires",
        hubs: [
          { city: "Buenos Aires", display: "Buenos Aires" },
          { city: "Dock Sud", display: "Dock Sud" },
          { city: "Zárate", display: "Zárate" },
        ],
      },
      {
        name: "Mendoza",
        hubs: [
          { city: "Mendoza", display: "Mendoza" },
          { city: "Uspallata", display: "Uspallata" },
        ],
      },
      {
        name: "Santa Fe",
        hubs: [
          { city: "Rosario", display: "Rosario" },
        ],
      },
      {
        name: "Córdoba",
        hubs: [
          { city: "Córdoba", display: "Córdoba" },
        ],
      },
    ],
  },
  {
    code: "EC",
    name: "Ecuador",
    dialCode: "+593",
    flag: "🇪🇨",
    regions: [
      {
        name: "Pichincha",
        hubs: [
          { city: "Quito", display: "Quito" },
        ],
      },
      {
        name: "Guayas",
        hubs: [
          { city: "Guayaquil", display: "Guayaquil" },
          { city: "Durán", display: "Durán" },
        ],
      },
      {
        name: "Carchi",
        hubs: [
          { city: "Tulcán", display: "Tulcán" },
        ],
      },
      {
        name: "El Oro",
        hubs: [
          { city: "Huaquillas", display: "Huaquillas" },
          { city: "Puerto Bolívar", display: "Puerto Bolívar" },
        ],
      },
    ],
  },
];

export function getCountryByCode(code: string): CountryLogistics | undefined {
  return LATAM_LOGISTICS_DIRECTORY.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function getCountryDialCode(code: string): string {
  return getCountryByCode(code)?.dialCode ?? "+51";
}
