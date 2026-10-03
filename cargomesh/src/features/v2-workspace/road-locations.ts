/** Local city references, not verified commercial facilities or carrier coverage. */
export const locationRegions = [
  { id: "south-america", es: "Sudamérica", en: "South America" },
  { id: "north-america", es: "Norteamérica", en: "North America" },
  { id: "europe", es: "Europa", en: "Europe" },
  { id: "asia", es: "Asia", en: "Asia" },
  { id: "africa", es: "África", en: "Africa" },
  { id: "oceania", es: "Oceanía", en: "Oceania" },
] as const;

type Region = typeof locationRegions[number]["id"];
type LandNetwork = "south-america" | "north-america" | "afro-eurasia" | "australia";
export type RoadLocation = {
  id: string; city: string; countryCode: string; region: Region;
  landNetwork: LandNetwork; lat: number; lng: number;
};

export const facilities: readonly RoadLocation[] = [
  { id: "callao", city: "Callao", countryCode: "PE", region: "south-america", landNetwork: "south-america", lat: -12.0464, lng: -77.1181 },
  { id: "arequipa", city: "Arequipa", countryCode: "PE", region: "south-america", landNetwork: "south-america", lat: -16.409, lng: -71.5375 },
  { id: "piura", city: "Piura", countryCode: "PE", region: "south-america", landNetwork: "south-america", lat: -5.1945, lng: -80.6328 },
  { id: "lima", city: "Lima", countryCode: "PE", region: "south-america", landNetwork: "south-america", lat: -12.0464, lng: -77.0428 },
  { id: "cl-santiago", city: "Santiago", countryCode: "CL", region: "south-america", landNetwork: "south-america", lat: -33.4489, lng: -70.6693 },
  { id: "buenos-aires", city: "Buenos Aires", countryCode: "AR", region: "south-america", landNetwork: "south-america", lat: -34.6037, lng: -58.3816 },
  { id: "bogota", city: "Bogotá", countryCode: "CO", region: "south-america", landNetwork: "south-america", lat: 4.711, lng: -74.0721 },
  { id: "sao-paulo", city: "São Paulo", countryCode: "BR", region: "south-america", landNetwork: "south-america", lat: -23.5505, lng: -46.6333 },
  { id: "mexico-city", city: "Ciudad de México", countryCode: "MX", region: "north-america", landNetwork: "north-america", lat: 19.4326, lng: -99.1332 },
  { id: "monterrey", city: "Monterrey", countryCode: "MX", region: "north-america", landNetwork: "north-america", lat: 25.6866, lng: -100.3161 },
  { id: "los-angeles", city: "Los Angeles", countryCode: "US", region: "north-america", landNetwork: "north-america", lat: 34.0522, lng: -118.2437 },
  { id: "las-vegas", city: "Las Vegas", countryCode: "US", region: "north-america", landNetwork: "north-america", lat: 36.1699, lng: -115.1398 },
  { id: "houston", city: "Houston", countryCode: "US", region: "north-america", landNetwork: "north-america", lat: 29.7604, lng: -95.3698 },
  { id: "toronto", city: "Toronto", countryCode: "CA", region: "north-america", landNetwork: "north-america", lat: 43.6532, lng: -79.3832 },
  { id: "madrid", city: "Madrid", countryCode: "ES", region: "europe", landNetwork: "afro-eurasia", lat: 40.4168, lng: -3.7038 },
  { id: "barcelona", city: "Barcelona", countryCode: "ES", region: "europe", landNetwork: "afro-eurasia", lat: 41.3874, lng: 2.1686 },
  { id: "paris", city: "Paris", countryCode: "FR", region: "europe", landNetwork: "afro-eurasia", lat: 48.8566, lng: 2.3522 },
  { id: "lyon", city: "Lyon", countryCode: "FR", region: "europe", landNetwork: "afro-eurasia", lat: 45.764, lng: 4.8357 },
  { id: "berlin", city: "Berlin", countryCode: "DE", region: "europe", landNetwork: "afro-eurasia", lat: 52.52, lng: 13.405 },
  { id: "hamburg", city: "Hamburg", countryCode: "DE", region: "europe", landNetwork: "afro-eurasia", lat: 53.5511, lng: 9.9937 },
  { id: "new-delhi", city: "Nueva Delhi", countryCode: "IN", region: "asia", landNetwork: "afro-eurasia", lat: 28.6139, lng: 77.209 },
  { id: "mumbai", city: "Mumbai", countryCode: "IN", region: "asia", landNetwork: "afro-eurasia", lat: 19.076, lng: 72.8777 },
  { id: "bangkok", city: "Bangkok", countryCode: "TH", region: "asia", landNetwork: "afro-eurasia", lat: 13.7563, lng: 100.5018 },
  { id: "chiang-mai", city: "Chiang Mai", countryCode: "TH", region: "asia", landNetwork: "afro-eurasia", lat: 18.7883, lng: 98.9853 },
  { id: "kuala-lumpur", city: "Kuala Lumpur", countryCode: "MY", region: "asia", landNetwork: "afro-eurasia", lat: 3.139, lng: 101.6869 },
  { id: "singapore", city: "Singapur", countryCode: "SG", region: "asia", landNetwork: "afro-eurasia", lat: 1.3521, lng: 103.8198 },
  { id: "johannesburg", city: "Johannesburgo", countryCode: "ZA", region: "africa", landNetwork: "afro-eurasia", lat: -26.2041, lng: 28.0473 },
  { id: "durban", city: "Durban", countryCode: "ZA", region: "africa", landNetwork: "afro-eurasia", lat: -29.8587, lng: 31.0218 },
  { id: "nairobi", city: "Nairobi", countryCode: "KE", region: "africa", landNetwork: "afro-eurasia", lat: -1.2921, lng: 36.8219 },
  { id: "mombasa", city: "Mombasa", countryCode: "KE", region: "africa", landNetwork: "afro-eurasia", lat: -4.0435, lng: 39.6682 },
  { id: "sydney", city: "Sydney", countryCode: "AU", region: "oceania", landNetwork: "australia", lat: -33.8688, lng: 151.2093 },
  { id: "melbourne", city: "Melbourne", countryCode: "AU", region: "oceania", landNetwork: "australia", lat: -37.8136, lng: 144.9631 },
  { id: "brisbane", city: "Brisbane", countryCode: "AU", region: "oceania", landNetwork: "australia", lat: -27.4698, lng: 153.0251 },
  { id: "adelaide", city: "Adelaide", countryCode: "AU", region: "oceania", landNetwork: "australia", lat: -34.9285, lng: 138.6007 },
];

export const findRoadLocation = (id: unknown) => facilities.find(location => location.id === id);

export function countryLabel(countryCode: string, locale: "es" | "en") {
  return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
}

export function cityLabel(location: RoadLocation, locale: "es" | "en") {
  const names: Record<string, { es: string; en: string }> = {
    "mexico-city": { es: "Ciudad de México", en: "Mexico City" },
    "paris": { es: "París", en: "Paris" }, "berlin": { es: "Berlín", en: "Berlin" },
    "hamburg": { es: "Hamburgo", en: "Hamburg" }, "new-delhi": { es: "Nueva Delhi", en: "New Delhi" },
    "singapore": { es: "Singapur", en: "Singapore" }, "johannesburg": { es: "Johannesburgo", en: "Johannesburg" },
    "sydney": { es: "Sídney", en: "Sydney" },
  };
  return names[location.id]?.[locale] ?? location.city;
}

/** A geographic prefilter only. Same network still requires a real provider route.
 * North/South America are separate: no through road across the Darién Gap.
 * Europe/Asia/Africa share this prefilter; borders/road availability remain unknown.
 */
export function landRoutePolicy(originId: unknown, destinationId: unknown) {
  const origin = findRoadLocation(originId);
  const destination = findRoadLocation(destinationId);
  if (!origin || !destination) return "invalid_location" as const;
  if (origin.id === destination.id) return "same_location" as const;
  return origin.landNetwork === destination.landNetwork ? "previewable" as const : "disconnected_networks" as const;
}
