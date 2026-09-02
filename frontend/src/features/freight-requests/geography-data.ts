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
          { city: "Callao", display: "Callao", tag: "Puerto" },
          { city: "Ventanilla", display: "Ventanilla", tag: "Industrial" },
          { city: "Bellavista", display: "Bellavista", tag: "Urbano" },
        ],
      },
      {
        name: "Lima",
        hubs: [
          { city: "Lima", display: "Lima Centro", tag: "Comercial" },
          { city: "Lurín", display: "Lurín", tag: "Industrial" },
          { city: "Huachipa", display: "Huachipa", tag: "Logístico" },
          { city: "Punta Hermosa", display: "Punta Hermosa", tag: "Sur" },
          { city: "Ate", display: "Ate / Vitarte", tag: "Industrial" },
        ],
      },
      {
        name: "Arequipa",
        hubs: [
          { city: "Arequipa", display: "Arequipa", tag: "Industrial" },
          { city: "Matarani", display: "Matarani", tag: "Puerto" },
          { city: "Mollendo", display: "Mollendo", tag: "Costa" },
        ],
      },
      {
        name: "Moquegua",
        hubs: [
          { city: "Ilo", display: "Ilo", tag: "Puerto" },
          { city: "Moquegua", display: "Moquegua", tag: "Minero" },
        ],
      },
      {
        name: "Tacna",
        hubs: [
          { city: "Tacna", display: "Tacna", tag: "Zona Franca" },
          { city: "Santa Rosa", display: "Santa Rosa", tag: "Frontera" },
        ],
      },
      {
        name: "Piura",
        hubs: [
          { city: "Paita", display: "Paita", tag: "Puerto" },
          { city: "Piura", display: "Piura", tag: "Agro" },
        ],
      },
      {
        name: "La Libertad",
        hubs: [
          { city: "Trujillo", display: "Trujillo", tag: "Industrial" },
          { city: "Salaverry", display: "Salaverry", tag: "Puerto" },
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
          { city: "Santiago", display: "Santiago (Centro de Distribución Central)", tag: "Urbano" },
          { city: "San Bernardo", display: "San Bernardo (Parque Logístico Sur)", tag: "Logístico" },
          { city: "Pudahuel", display: "Pudahuel (Aeropuerto AMB / Carga)", tag: "Aéreo" },
          { city: "Quilicura", display: "Quilicura (Hub Logístico Norte)", tag: "Industrial" },
        ],
      },
      {
        name: "Valparaíso",
        hubs: [
          { city: "Valparaíso", display: "Valparaíso (TPS Terminal)", tag: "Puerto" },
          { city: "San Antonio", display: "San Antonio (Puerto Principal)", tag: "Puerto" },
          { city: "Los Andes", display: "Los Andes (Puerto Terrestre / Paso Los Libertadores)", tag: "Frontera" },
        ],
      },
      {
        name: "Antofagasta",
        hubs: [
          { city: "Antofagasta", display: "Antofagasta (Hub Logístico Minero)", tag: "Minero" },
          { city: "Calama", display: "Calama (Corredor Codelco / Minería)", tag: "Minero" },
          { city: "Mejillones", display: "Mejillones (Megapuerto Industrial)", tag: "Puerto" },
        ],
      },
      {
        name: "Tarapacá",
        hubs: [
          { city: "Iquique", display: "Iquique (ZOFRI Zona Franca)", tag: "Zona Franca" },
          { city: "Iquique", display: "Iquique (Terminal Portuario)", tag: "Puerto" },
        ],
      },
      {
        name: "Arica y Parinacota",
        hubs: [
          { city: "Arica", display: "Arica (Terminal Puerto Arica TPA)", tag: "Puerto" },
          { city: "Chacalluta", display: "Paso Chacalluta (Frontera Internacional Perú)", tag: "Frontera" },
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
          { city: "Bogotá", display: "Bogotá D.C. (Terminal de Carga El Dorado)", tag: "Urbano" },
          { city: "Funza", display: "Funza / Siberia (Mega Parque Logístico)", tag: "Logístico" },
        ],
      },
      {
        name: "Valle del Cauca",
        hubs: [
          { city: "Buenaventura", display: "Buenaventura (Puerto Principal Pacífico)", tag: "Puerto" },
          { city: "Cali", display: "Cali (Yumbo Zona Industrial)", tag: "Industrial" },
        ],
      },
      {
        name: "Antioquia",
        hubs: [
          { city: "Medellín", display: "Medellín (Área Metropolitana)", tag: "Urbano" },
          { city: "Rionegro", display: "Rionegro (Zona Franca)", tag: "Logístico" },
        ],
      },
      {
        name: "Nariño",
        hubs: [
          { city: "Ipiales", display: "Ipiales (Paso Fronterizo Rumichaca a Ecuador)", tag: "Frontera" },
          { city: "Pasto", display: "Pasto (Corredor Panamericano Sur)", tag: "Logístico" },
        ],
      },
      {
        name: "Atlántico",
        hubs: [
          { city: "Barranquilla", display: "Barranquilla (Puerto Marítimo y Fluvial)", tag: "Puerto" },
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
          { city: "La Paz", display: "La Paz (Sede de Gobierno)", tag: "Urbano" },
          { city: "El Alto", display: "El Alto (Aeropuerto / Centro Logístico)", tag: "Industrial" },
          { city: "Desaguadero", display: "Desaguadero (Paso Fronterizo Internacional a Perú)", tag: "Frontera" },
        ],
      },
      {
        name: "Santa Cruz",
        hubs: [
          { city: "Santa Cruz de la Sierra", display: "Santa Cruz (Parque Industrial Latinoamericano)", tag: "Industrial" },
          { city: "Montero", display: "Montero (Hub Agroindustrial)", tag: "Agro" },
        ],
      },
      {
        name: "Cochabamba",
        hubs: [
          { city: "Cochabamba", display: "Cochabamba (Eje Central de Carga)", tag: "Logístico" },
        ],
      },
      {
        name: "Oruro",
        hubs: [
          { city: "Oruro", display: "Tambor Quemado (Paso Fronterizo Internacional a Chile)", tag: "Frontera" },
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
          { city: "Buenos Aires", display: "Buenos Aires (Puerto Retiro / CABA)", tag: "Puerto" },
          { city: "Dock Sud", display: "Dock Sud (Exolgan Terminal)", tag: "Puerto" },
          { city: "Zárate", display: "Zárate (Terminal Fluvial / Automotriz)", tag: "Logístico" },
        ],
      },
      {
        name: "Mendoza",
        hubs: [
          { city: "Mendoza", display: "Mendoza (Hub Logístico Andino)", tag: "Logístico" },
          { city: "Uspallata", display: "Uspallata (Paso Los Libertadores Cristo Redentor a Chile)", tag: "Frontera" },
        ],
      },
      {
        name: "Santa Fe",
        hubs: [
          { city: "Rosario", display: "Rosario (Hub Portuario y Granelero)", tag: "Puerto" },
        ],
      },
      {
        name: "Córdoba",
        hubs: [
          { city: "Córdoba", display: "Córdoba (Centro Industrial)", tag: "Industrial" },
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
          { city: "Quito", display: "Quito (Tababela Cargo Hub)", tag: "Aéreo" },
        ],
      },
      {
        name: "Guayas",
        hubs: [
          { city: "Guayaquil", display: "Guayaquil (Puerto Contecon)", tag: "Puerto" },
          { city: "Durán", display: "Durán (Parque Industrial)", tag: "Industrial" },
        ],
      },
      {
        name: "Carchi",
        hubs: [
          { city: "Tulcán", display: "Tulcán (Paso Fronterizo Rumichaca a Colombia)", tag: "Frontera" },
        ],
      },
      {
        name: "El Oro",
        hubs: [
          { city: "Huaquillas", display: "Huaquillas (Paso Fronterizo a Perú / Tumbes)", tag: "Frontera" },
          { city: "Puerto Bolívar", display: "Puerto Bolívar (Machala)", tag: "Puerto" },
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
