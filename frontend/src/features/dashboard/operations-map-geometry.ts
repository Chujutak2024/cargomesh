import type {
  OperationsMapCheckpoint,
  OperationsMapModel,
  OperationsMapPlace,
} from "./operations-map-contract";

export type OperationsMapRoutePoint = OperationsMapPlace & {
  coordinates: [number, number];
  id: string;
  kind: "origin" | "checkpoint" | "nominal" | "destination";
  label?: string;
  occurredAt?: string;
};

export type OperationsMapRoute = {
  points: OperationsMapRoutePoint[];
  polylineCoordinates: [number, number][];
  isNominal: boolean;
  followsRoadCorridor: boolean;
};

/**
 * Coordinates for every city exposed by geography-data.ts. They are only
 * display anchors: the persisted city/country pair remains the source of
 * truth and no location is inferred from an address string.
 */
const LOCATION_COORDINATES: Record<string, [number, number]> = {
  "PE:callao": [-12.0566, -77.1181],
  "PE:ventanilla": [-11.8775, -77.1260],
  "PE:bellavista": [-12.0627, -77.1291],
  "PE:lima": [-12.0464, -77.0428],
  "PE:lurin": [-12.2748, -76.8698],
  "PE:huachipa": [-12.0033, -76.9350],
  "PE:punta hermosa": [-12.3333, -76.8240],
  "PE:ate": [-12.0264, -76.9190],
  "PE:arequipa": [-16.4090, -71.5375],
  "PE:matarani": [-17.0054, -72.1011],
  "PE:mollendo": [-17.0231, -72.0147],
  "PE:ilo": [-17.6394, -71.3375],
  "PE:moquegua": [-17.1939, -70.9350],
  "PE:tacna": [-18.0066, -70.2463],
  "PE:santa rosa": [-18.3058, -70.3150],
  "PE:paita": [-5.0892, -81.1144],
  "PE:piura": [-5.1945, -80.6328],
  "PE:trujillo": [-8.1116, -79.0287],
  "PE:salaverry": [-8.2217, -78.9767],
  "CL:santiago": [-33.4489, -70.6693],
  "CL:san bernardo": [-33.5922, -70.6996],
  "CL:pudahuel": [-33.4372, -70.6506],
  "CL:quilicura": [-33.3571, -70.7290],
  "CL:valparaiso": [-33.0472, -71.6127],
  "CL:san antonio": [-33.5930, -71.6210],
  "CL:los andes": [-32.8337, -70.5983],
  "CL:antofagasta": [-23.6509, -70.3975],
  "CL:calama": [-22.4544, -68.9294],
  "CL:mejillones": [-23.1010, -70.4480],
  "CL:iquique": [-20.2307, -70.1357],
  "CL:alto hospicio": [-20.2690, -70.1020],
  "CL:arica": [-18.4783, -70.3126],
  "CL:chacalluta": [-18.3480, -70.3350],
  "CO:bogota": [4.7110, -74.0721],
  "CO:funza": [4.7160, -74.2120],
  "CO:buenaventura": [3.8770, -77.0270],
  "CO:cali": [3.4516, -76.5320],
  "CO:medellin": [6.2442, -75.5812],
  "CO:rionegro": [6.1500, -75.3740],
  "CO:ipiales": [0.8300, -77.6440],
  "CO:pasto": [1.2140, -77.2780],
  "CO:barranquilla": [10.9685, -74.7813],
  "BO:la paz": [-16.4897, -68.1193],
  "BO:el alto": [-16.5000, -68.1500],
  "BO:desaguadero": [-16.5650, -69.0410],
  "BO:santa cruz de la sierra": [-17.7833, -63.1821],
  "BO:montero": [-17.3420, -63.2550],
  "BO:cochabamba": [-17.3895, -66.1568],
  "BO:oruro": [-17.9647, -67.1060],
  "AR:buenos aires": [-34.6037, -58.3816],
  "AR:dock sud": [-34.6520, -58.3350],
  "AR:zarate": [-34.0950, -59.0240],
  "AR:mendoza": [-32.8895, -68.8458],
  "AR:uspallata": [-32.5930, -69.3470],
  "AR:rosario": [-32.9587, -60.6930],
  "AR:cordoba": [-31.4201, -64.1888],
  "EC:quito": [-0.1807, -78.4678],
  "EC:guayaquil": [-2.1709, -79.9224],
  "EC:duran": [-2.1700, -79.8310],
  "EC:tulcan": [0.8119, -77.7173],
  "EC:huaquillas": [-3.4810, -80.2430],
  "EC:puerto bolivar": [-3.2670, -79.9970],
};

/**
 * Down-sampled, static OSRM/OSM road geometry for the canonical demo route.
 * It is a planned reference corridor, never live telemetry. Runtime rendering
 * performs no routing/geocoding request and therefore remains deterministic.
 */
const CALLAO_SANTIAGO_ROAD_CORRIDOR: [number, number][] = [
  [-12.056579, -77.117758], [-12.064873, -77.039350],
  [-12.228652, -76.968704], [-12.621811, -76.670636],
  [-12.916019, -76.502042], [-13.192656, -76.349605],
  [-13.563597, -76.180125], [-13.839105, -76.137871],
  [-14.079056, -75.738015], [-14.286613, -75.680854],
  [-14.528197, -75.203799], [-14.706279, -75.101280],
  [-14.959774, -74.985871], [-15.564622, -74.726378],
  [-15.784523, -74.417833], [-15.816671, -74.305812],
  [-15.898457, -74.165633], [-16.230378, -73.601321],
  [-16.309918, -73.376717], [-16.382278, -73.267853],
  [-16.426786, -73.151084], [-16.487691, -73.017377],
  [-16.591339, -72.740501], [-16.662069, -72.603868],
  [-16.700738, -72.455199], [-16.762564, -72.347919],
  [-16.918690, -72.136035], [-16.994677, -72.086678],
  [-17.094846, -71.910833], [-17.242552, -71.572661],
  [-17.367248, -71.416098], [-17.612787, -71.343031],
  [-17.907439, -70.956231], [-18.124224, -70.387563],
  [-18.006380, -70.246444], [-18.236633, -70.323076],
  [-18.469744, -70.303914], [-18.582436, -70.250285],
  [-18.766535, -70.223423], [-18.860157, -70.094060],
  [-19.062437, -70.068447], [-19.132858, -70.163444],
  [-19.198734, -70.043198], [-19.239522, -69.952332],
  [-19.412298, -69.935238], [-19.548572, -69.952174],
  [-20.075420, -69.735854], [-20.213610, -69.889065],
  [-20.272474, -70.037665], [-20.250876, -70.116551],
  [-20.280346, -70.127050], [-20.376015, -70.170165],
  [-20.772051, -70.181152], [-20.961005, -70.139178],
  [-21.056813, -70.153013], [-21.264738, -70.077710],
  [-21.546763, -70.084636], [-21.761664, -70.154005],
  [-21.881648, -70.153928], [-22.016871, -70.194009],
  [-22.110858, -70.212343], [-22.259770, -70.232271],
  [-22.381094, -70.237416], [-22.512759, -70.242703],
  [-22.681697, -70.271209], [-22.977439, -70.301626],
  [-23.475515, -70.419982], [-23.631039, -70.394021],
  [-23.701994, -70.393367], [-23.791820, -70.316673],
  [-24.311156, -70.291177], [-24.777213, -70.378629],
  [-24.942638, -70.383464], [-24.980683, -70.402723],
  [-25.018670, -70.429813], [-25.003197, -70.460688],
  [-25.156496, -70.453173], [-25.276547, -70.442991],
  [-25.374878, -70.449191], [-25.484421, -70.435088],
  [-25.669922, -70.359271], [-26.013408, -70.406868],
  [-26.280832, -70.469289], [-26.353426, -70.538919],
  [-26.367702, -70.658750], [-26.562977, -70.677959],
  [-26.949952, -70.789154], [-27.343854, -70.693901],
  [-27.322764, -70.444367], [-27.548869, -70.441127],
  [-27.828989, -70.511653], [-28.236862, -70.687457],
  [-28.559739, -70.777567], [-28.730414, -70.770608],
  [-28.821569, -70.811280], [-28.944806, -70.890618],
  [-29.133583, -70.945457], [-29.145017, -70.993187],
  [-29.228815, -71.015070], [-29.376616, -71.115874],
  [-29.563388, -71.254496], [-29.608564, -71.258871],
  [-29.688416, -71.307338], [-29.878848, -71.256370],
  [-29.967045, -71.326231], [-30.064005, -71.361762],
  [-30.640234, -71.512409], [-30.886899, -71.608433],
  [-31.124906, -71.597928], [-31.321113, -71.594332],
  [-31.735160, -71.517858], [-31.980228, -71.500866],
  [-32.239981, -71.494174], [-32.488541, -71.258614],
  [-32.739578, -71.198660], [-32.854217, -70.860510],
  [-33.056398, -70.874748], [-33.246401, -70.754087],
  [-33.448887, -70.669243],
];

const CORRIDOR_HUBS: OperationsMapPlace[] = [
  { city: "Arequipa", countryCode: "PE" },
  { city: "Tacna", countryCode: "PE" },
  { city: "Arica", countryCode: "CL" },
  { city: "Iquique", countryCode: "CL" },
  { city: "Antofagasta", countryCode: "CL" },
];

export function normalizedMapCountry(countryCode: string) {
  const value = countryCode.trim().toUpperCase();
  if (value === "PERU" || value === "PERÚ") return "PE";
  if (value === "CHILE") return "CL";
  return value;
}

function normalizedCity(city: string) {
  return city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function operationsMapPlaceKey(place: OperationsMapPlace) {
  return `${normalizedMapCountry(place.countryCode)}:${normalizedCity(place.city)}`;
}

export function operationsMapCoordinatesFor(place: OperationsMapPlace) {
  return LOCATION_COORDINATES[operationsMapPlaceKey(place)];
}

function nearestCorridorIndex(coordinates: [number, number]) {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  CALLAO_SANTIAGO_ROAD_CORRIDOR.forEach((point, index) => {
    const latitudeDelta = point[0] - coordinates[0];
    const longitudeDelta = point[1] - coordinates[1];
    const distance = latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
}

function supportsCanonicalCorridor(origin: OperationsMapPlace, destination: OperationsMapPlace) {
  const originCountry = normalizedMapCountry(origin.countryCode);
  const destinationCountry = normalizedMapCountry(destination.countryCode);
  return [originCountry, destinationCountry].every((country) => country === "PE" || country === "CL");
}

function distinctCoordinates(points: [number, number][]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;
    return Math.abs(previous[0] - point[0]) > 0.0001 || Math.abs(previous[1] - point[1]) > 0.0001;
  });
}

function canonicalCorridorSlice(origin: [number, number], destination: [number, number]) {
  const originIndex = nearestCorridorIndex(origin);
  const destinationIndex = nearestCorridorIndex(destination);
  if (originIndex === destinationIndex) return distinctCoordinates([origin, destination]);

  const start = Math.min(originIndex, destinationIndex);
  const end = Math.max(originIndex, destinationIndex);
  const segment = CALLAO_SANTIAGO_ROAD_CORRIDOR.slice(start, end + 1);
  if (originIndex > destinationIndex) segment.reverse();
  const route = distinctCoordinates([origin, ...segment, destination]);
  route[0] = origin;
  route[route.length - 1] = destination;
  return route;
}

function mappedCheckpoint(checkpoint: OperationsMapCheckpoint): OperationsMapRoutePoint[] {
  const coordinates = operationsMapCoordinatesFor(checkpoint);
  return coordinates ? [{ ...checkpoint, coordinates, kind: "checkpoint" }] : [];
}

export function createOperationsMapRoute(model: OperationsMapModel): OperationsMapRoute {
  const originCoord = operationsMapCoordinatesFor(model.origin);
  const destinationCoord = operationsMapCoordinatesFor(model.destination);
  if (!originCoord || !destinationCoord) {
    return { points: [], polylineCoordinates: [], isNominal: false, followsRoadCorridor: false };
  }

  const checkpoints = model.checkpoints.flatMap(mappedCheckpoint);
  if (checkpoints.length > 0) {
    const points: OperationsMapRoutePoint[] = [
      { ...model.origin, id: "origin", kind: "origin", coordinates: originCoord },
      ...checkpoints,
      { ...model.destination, id: "destination", kind: "destination", coordinates: destinationCoord },
    ];
    return {
      points,
      polylineCoordinates: points.map((point) => point.coordinates),
      isNominal: false,
      followsRoadCorridor: false,
    };
  }

  const followsRoadCorridor = supportsCanonicalCorridor(model.origin, model.destination);
  const polylineCoordinates = followsRoadCorridor
    ? canonicalCorridorSlice(originCoord, destinationCoord)
    : [originCoord, destinationCoord];
  const corridorStart = followsRoadCorridor ? nearestCorridorIndex(originCoord) : 0;
  const corridorEnd = followsRoadCorridor ? nearestCorridorIndex(destinationCoord) : 0;
  const lowerBound = Math.min(corridorStart, corridorEnd);
  const upperBound = Math.max(corridorStart, corridorEnd);

  const nominalHubs = followsRoadCorridor
    ? CORRIDOR_HUBS.flatMap<OperationsMapRoutePoint>((hub, index) => {
        const coordinates = operationsMapCoordinatesFor(hub);
        if (!coordinates || operationsMapPlaceKey(hub) === operationsMapPlaceKey(model.origin)
          || operationsMapPlaceKey(hub) === operationsMapPlaceKey(model.destination)) return [];
        const hubIndex = nearestCorridorIndex(coordinates);
        return hubIndex > lowerBound && hubIndex < upperBound
          ? [{ ...hub, id: `hub-${index}`, kind: "nominal", coordinates }]
          : [];
      })
    : [];

  return {
    points: [
      { ...model.origin, id: "origin", kind: "origin", coordinates: originCoord },
      ...nominalHubs,
      { ...model.destination, id: "destination", kind: "destination", coordinates: destinationCoord },
    ],
    polylineCoordinates,
    isNominal: true,
    followsRoadCorridor,
  };
}
