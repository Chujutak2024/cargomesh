import type { FleetVehicle } from "./fleet-model";

/** Reference photographs only. They are never evidence of a registered vehicle. */
export const fleetPhotos = {
  rigid: {
    src: "/v2-workspace/fleet-photos/rigid.webp", es: "Camión rígido", en: "Rigid box truck",
    author: "DeFacto", license: "CC BY-SA 2.5", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:DAF_LF_2005.jpg", position: "50% 55%",
  },
  articulated: {
    src: "/v2-workspace/fleet-photos/articulated.webp", es: "Tracto con remolque", en: "Tractor with trailer",
    author: "Oto Zapletal", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:A_VOLVO_truck_tractor_with_a_semi-trailer_on_the_road_in_Levo%C4%8Da,_Slovakia.jpg", position: "50% 60%",
  },
  refrigerated: {
    src: "/v2-workspace/fleet-photos/refrigerated.webp", es: "Tracto refrigerado", en: "Refrigerated tractor-trailer",
    author: "Rundvald", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Chereau-semiremorque-byRundvald.jpg", position: "50% 60%",
  },
  flatbed: {
    src: "/v2-workspace/fleet-photos/flatbed.webp", es: "Camión plataforma", en: "Flatbed truck",
    author: "Secret Coach Park", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:MAN_flatbed_truck_on_the_A40_in_Monmouth,_Wales.jpg", position: "50% 55%",
  },
  tipper: {
    src: "/v2-workspace/fleet-photos/tipper.webp", es: "Volquete", en: "Tipper truck",
    author: "Barry Lewis", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Campbell%27s_artic_tipper_truck,_Teignmouth_Dock,_14_May_2013.jpg", position: "50% 70%",
  },
  tanker: {src:"/v2-workspace/fleet-photos/tanker.webp",es:"Camión cisterna",en:"Tanker truck",author:"Ximonic (Simo Räsänen)",license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",sourceUrl:"https://commons.wikimedia.org/wiki/File:Volvo_tanker_by_Lyngen_fjord_in_Skibotn,_Storfjord,_Troms_og_Finnmark,_Norway,_2023_September.jpg",position:"70% 70%"},
  mixer: {src:"/v2-workspace/fleet-photos/mixer.webp",es:"Camión mezclador",en:"Concrete mixer",author:"Antti Leppänen",license:"CC BY-SA 3.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/3.0/",sourceUrl:"https://commons.wikimedia.org/wiki/File:Scania_cement_mixer_truck_Jyv%C3%A4skyl%C3%A4.JPG",position:"50% 50%"},
  curtainsider: {src:"/v2-workspace/fleet-photos/curtainsider.webp",es:"Tracto con lona lateral",en:"Curtainsider",author:"dickinsonjohn02",license:"Public domain",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",sourceUrl:"https://commons.wikimedia.org/wiki/File:172-365_Scania_R520_Super.jpg",position:"50% 50%"},
  lowloader: {src:"/v2-workspace/fleet-photos/lowloader.webp",es:"Tracto con cama baja",en:"Low loader",author:"Alf van Beem",license:"CC0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",sourceUrl:"https://commons.wikimedia.org/wiki/File:MAN_TGX,_39235200396800U8ACB,_Balvert_%26_Zn.JPG",position:"50% 60%"},
  logging: {src:"/v2-workspace/fleet-photos/logging.webp",es:"Camión maderero",en:"Logging truck",author:"dickinsonjohn02",license:"Public domain",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",sourceUrl:"https://commons.wikimedia.org/wiki/File:152-365_Scania_R620_and_timber_trailer.jpg",position:"50% 55%"},
  articulatedAlternate: {
    src: "/v2-workspace/fleet-photos/articulated-alternate.webp", es: "Tracto con semirremolque", en: "Semi-trailer truck",
    author: "Jason Lawrence", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Freightliner_Cascadia_hauling_a_McLane_trailer.jpg", position: "50% 65%",
  },
} as const;

export function fleetReferencePhoto(vehicle: FleetVehicle) {
  if(vehicle.photoDataUrl)return {...fleetPhotos[vehicle.variant],src:vehicle.photoDataUrl,es:"Foto del camión",en:"Truck photo"};
  if(vehicle.source === "SERVICE" && vehicle.visual) return {...fleetPhotos[vehicle.variant], src:vehicle.visual.poster, position:"50% 50%", es:"Modelo 3D de referencia", en:"3D model reference"};
  if(vehicle.source === "SERVICE") return {...fleetPhotos[vehicle.variant], src:'/v2-workspace/trucks/reference.svg', es:'Sin modelo específico', en:'No specific model'};
  // The alternate is an example's presentation choice, not a service-record photo.
  return vehicle.source === "EXAMPLE" && vehicle.code === "CM-212"
    ? fleetPhotos.articulatedAlternate : fleetPhotos[vehicle.variant];
}
