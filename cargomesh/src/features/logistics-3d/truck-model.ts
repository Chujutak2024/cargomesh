import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { TruckAppearance } from './visual-catalog';

export const truckVisualTypes = ["rigid", "articulated", "refrigerated", "flatbed", "tipper", "tanker", "mixer", "curtainsider", "lowloader", "logging"] as const;
export type TruckVisualType = typeof truckVisualTypes[number];
const liveries: Record<TruckVisualType, { cab:string; accent:string; body:string }> = {
  rigid:{cab:"#b52c37",accent:"#f3c14c",body:"#d13945"}, articulated:{cab:"#16455e",accent:"#07a8b6",body:"#e8eef2"},
  refrigerated:{cab:"#edf0ee",accent:"#238abd",body:"#eef5f6"}, flatbed:{cab:"#177368",accent:"#ddd5a9",body:"#6b9f92"},
  tipper:{cab:"#234658",accent:"#eeb632",body:"#e8ad35"}, tanker:{cab:"#c04b31",accent:"#f2d4a7",body:"#bacbd3"},
  mixer:{cab:"#f3e9d0",accent:"#da6335",body:"#d96a39"}, curtainsider:{cab:"#43447d",accent:"#e9b546",body:"#465c9c"},
  lowloader:{cab:"#d2a62f",accent:"#283e4a",body:"#e3b531"}, logging:{cab:"#38774b",accent:"#d7bb78",body:"#aa794e"},
};
const wheelAngles = new WeakMap<THREE.Group, { value: number }>();
const cargoDoors = new WeakMap<THREE.Group, THREE.Group[]>();
export function setTruckCargoAccess(truck:THREE.Group,open:number){cargoDoors.get(truck)?.forEach((door,i)=>{door.rotation.y=(i===0?1:-1)*Math.max(0,Math.min(1,open))*Math.PI*.78;});}

/** Drives the original catalog's wheels without adding a draw call per wheel. */
export function setTruckWheelAngle(truck: THREE.Group, angle: number) {
  const uniform = wheelAngles.get(truck);
  if (uniform) uniform.value = angle;
}

/** Original CargoMesh studio equipment. Decorative, never an assigned asset. */
export function buildCargoMeshTruck(variant: TruckVisualType = "articulated", options: { cargoAccess?: boolean; appearance?: TruckAppearance; designId?: string } = {}) {
  const livery=options.appearance ?? liveries[variant];
  const materials = {
    paint: new THREE.MeshPhysicalMaterial({ color: livery.cab, metalness: .56, roughness: .25, clearcoat: .85, clearcoatRoughness: .16 }),
    teal: new THREE.MeshStandardMaterial({ color: livery.accent, metalness: variant === "logging" ? 0 : .35, roughness: variant === "logging" ? .85 : .3 }),
    alloy: new THREE.MeshStandardMaterial({ color: "#c7d2d8", metalness: .92, roughness: .23 }),
    trailer: new THREE.MeshStandardMaterial({ color: livery.body, metalness: variant === "logging" ? 0 : variant === "tanker" ? .8 : .25, roughness: variant === "logging" ? .88 : variant === "tanker" ? .24 : .5 }),
    dark: new THREE.MeshStandardMaterial({ color: "#182731", metalness: .35, roughness: .58 }),
    tyre: new THREE.MeshStandardMaterial({ color: "#131b23", roughness: .92 }),
    // Alpha glass over actual apertures reveals the cabin without a costly transmission pass.
    glass: new THREE.MeshPhysicalMaterial({ color: "#34596b", metalness: .12, roughness: .12, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .58, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
    interior: new THREE.MeshStandardMaterial({ color: "#46535d", roughness: .92 }),
    lamp: new THREE.MeshStandardMaterial({ color: "#e7f6ff", emissive: "#b8dfed", emissiveIntensity: .2, roughness: .25 }),
    red: new THREE.MeshStandardMaterial({ color: "#b82b36", emissive: "#e43729", emissiveIntensity: .12, roughness: .3 }),
    amber: new THREE.MeshStandardMaterial({ color: "#ffb94a", emissive: "#ff8c26", emissiveIntensity: .15, roughness: .3 }),
  };
  type Material = keyof typeof materials;
  const pieces = new Map<Material, THREE.BufferGeometry[]>();
  let componentCount = 0;
  let wheelAxle: number | null = null;
  const add = (geometry: THREE.BufferGeometry, material: Material, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    // Non-indexed geometry with matching attributes permits one draw per material.
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformed.applyMatrix4(matrix); geometry.dispose();
    const count = transformed.attributes.position.count;
    transformed.setAttribute("wheelAxle", new THREE.Float32BufferAttribute(new Float32Array(count).fill(wheelAxle ?? 0), 1));
    transformed.setAttribute("wheelMask", new THREE.Float32BufferAttribute(new Float32Array(count).fill(wheelAxle === null ? 0 : 1), 1));
    const bucket = pieces.get(material) ?? []; bucket.push(transformed); pieces.set(material, bucket); componentCount++;
  };
  const box = (size: [number, number, number], position: [number, number, number], material: Material, radius = .03, rotation: [number, number, number] = [0, 0, 0]) =>
    add(new RoundedBoxGeometry(...size, 1, radius), material, position, rotation);
  const detailBox = (size: [number, number, number], position: [number, number, number], material: Material, rotation: [number, number, number] = [0, 0, 0]) =>
    add(new THREE.BoxGeometry(...size), material, position, rotation);
  const pipe = (points: [number, number, number][], radius: number, material: Material) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), Math.max(4, points.length * 3), radius, 6, false), material, [0, 0, 0]);
  const roundedRectangle = (width: number, height: number, radius: number) => {
    const shape = new THREE.Shape(), x = -width / 2, y = -height / 2;
    shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius); shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius); shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y); return shape;
  };
  // Front faces -X; 13.7 m proportions normalized for a studio product visual.
  box([2.1, .18, 1.28], [-2.55, .67, 0], "dark");
  const sideWindow = () => {
    const shape = new THREE.Shape();
    shape.moveTo(-3.31, 1.64); shape.lineTo(-3.155, 2.15); shape.lineTo(-2.54, 2.15); shape.lineTo(-2.54, 1.64); shape.closePath();
    return shape;
  };
  // Thin, hollow side shells replace the solid block that used to cover the windshield.
  for (const side of [-1, 1]) {
    const cab = new THREE.Shape();
    cab.moveTo(-3.5, .82); cab.lineTo(-3.5, 1.46); cab.lineTo(-3.28, 2.18);
    cab.quadraticCurveTo(-3.25, 2.3, -3.13, 2.3); cab.lineTo(-2.42, 2.3); cab.lineTo(-2.42, .82); cab.closePath();
    cab.holes.push(new THREE.Path(sideWindow().getPoints()));
    add(new THREE.ExtrudeGeometry(cab, { depth: .055, bevelEnabled: true, bevelSegments: 2, bevelSize: .012, bevelThickness: .01, curveSegments: 8 }), "paint", [0, 0, side === 1 ? .55 : -.605]);
    const seal = new THREE.Shape();
    seal.moveTo(-3.355, 1.603); seal.lineTo(-3.183, 2.19); seal.lineTo(-2.502, 2.19); seal.lineTo(-2.502, 1.603); seal.closePath();
    seal.holes.push(new THREE.Path(sideWindow().getPoints()));
    add(new THREE.ExtrudeGeometry(seal, { depth: .024, bevelEnabled: false }), "dark", [0, 0, side === 1 ? .618 : -.642]);
    add(new THREE.ShapeGeometry(sideWindow()), "glass", [0, 0, side * .636]);
    detailBox([.028, .5, .023], [-3.065, 1.894, side * .644], "dark");
    detailBox([.68, .012, .023], [-2.905, 1.64, side * .645], "alloy");
  }
  box([1.1, .1, 1.16], [-2.96, .88, 0], "dark", .012);
  box([.78, .075, 1.16], [-2.78, 2.295, 0], "paint", .025);
  box([.11, .65, 1.15], [-3.465, 1.145, 0], "paint", .025);
  box([.085, .14, 1.14], [-3.473, 1.52, 0], "paint", .012, [0, 0, -.297]);
  box([.93, 1.68, 1.28], [-2.02, 1.65, 0], "paint", .1);
  box([.72, .16, 1.21], [-2.15, 2.55, 0], "paint", .06, [0, 0, -.19]);
  // Windshield, surround and wipers share the same inclined plane, so no glass is buried in paint.
  const slope = new THREE.Vector3(.22, .72, 0).normalize();
  const windshieldBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), slope, new THREE.Vector3(-slope.y, slope.x, 0));
  windshieldBasis.setPosition(-3.381, 1.907, 0);
  const windGeometry = (geometry: THREE.BufferGeometry, material: Material, offset = 0) => {
    geometry.translate(0, 0, offset); geometry.applyMatrix4(windshieldBasis); add(geometry, material, [0, 0, 0]);
  };
  const surround = roundedRectangle(1.23, .78, .04);
  surround.holes.push(new THREE.Path(roundedRectangle(1.14, .674, .028).getPoints()));
  windGeometry(new THREE.ExtrudeGeometry(surround, { depth: .032, bevelEnabled: false, curveSegments: 6 }), "paint", -.018);
  const gasket = roundedRectangle(1.14, .674, .028);
  gasket.holes.push(new THREE.Path(roundedRectangle(1.055, .59, .024).getPoints()));
  windGeometry(new THREE.ExtrudeGeometry(gasket, { depth: .024, bevelEnabled: false, curveSegments: 6 }), "dark", .015);
  windGeometry(new THREE.ShapeGeometry(roundedRectangle(1.055, .59, .024), 6), "glass", .025);
  box([.13, .065, 1.26], [-3.274, 2.285, 0], "paint", .018);
  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(.015, .23, .012); arm.rotateZ(side * -.3); arm.translate(side * .28, -.15, .048); windGeometry(arm, "dark");
    const blade = new THREE.BoxGeometry(.4, .019, .018); blade.rotateZ(side * .1); blade.translate(side * .26, -.07, .055); windGeometry(blade, "dark");
    const pivot = new THREE.CylinderGeometry(.025, .025, .012, 10); pivot.rotateX(Math.PI / 2); pivot.translate(side * .32, -.27, .046); windGeometry(pivot, "alloy");
  }
  // Restrained interior remains visible through all three real window openings.
  box([.23, .18, 1.03], [-3.285, 1.59, 0], "dark", .035);
  box([.18, .035, .4], [-3.23, 1.7, .28], "interior", .012);
  for (const side of [-1, 1]) {
    box([.36, .12, .33], [-2.82, 1.25, side * .29], "interior", .045);
    box([.14, .53, .33], [-2.585, 1.49, side * .29], "interior", .05, [0, 0, -.1]);
    box([.12, .13, .23], [-2.59, 1.81, side * .29], "interior", .035);
    detailBox([.022, .38, .025], [-2.5, 1.46, side * .47], "dark", [0, 0, -.14]);
    box([.31, .3, .026], [-2.86, 1.28, side * .568], "interior", .035);
  }
  add(new THREE.TorusGeometry(.124, .016, 6, 20), "dark", [-3.07, 1.58, .29], [0, Math.PI / 2, -.2]);
  pipe([[-3.21, 1.46, .29], [-3.09, 1.57, .29]], .025, "dark");
  detailBox([.018, .205, .02], [-3.07, 1.58, .29], "alloy");
  detailBox([.02, .022, .205], [-3.07, 1.58, .29], "alloy");
  for (const side of [-1, 1]) {
    pipe([[-3.19, 2.055, side * .621], [-3.34, 2.08, side * .83], [-3.395, 2.045, side * .92]], .018, "dark");
    pipe([[-3.2, 1.77, side * .621], [-3.38, 1.82, side * .92]], .016, "dark");
    box([.15, .33, .13], [-3.38, 1.95, side * .92], "dark", .025);
    box([.018, .21, .095], [-3.297, 2.005, side * .92], "alloy", .015);
    box([.018, .08, .095], [-3.297, 1.84, side * .92], "alloy", .012);
    box([.5, .11, .035], [-2.96, 1.29, side * .629], "teal", .012);
    box([.18, .055, .035], [-2.715, 1.51, side * .632], "dark", .013);
    box([.12, .025, .04], [-2.715, 1.517, side * .651], "alloy", .008);
    box([.65, .3, .16], [-1.9, .72, side * .63], "alloy", .07);
    box([.09, .72, .1], [-1.64, 1.2, side * .57], "alloy");
    // Door outlines and twin perforated access steps.
    detailBox([.014, .66, .015], [-2.51, 1.27, side * .622], "dark");
    detailBox([.69, .014, .015], [-2.87, .99, side * .622], "dark");
    for (const height of [.62, .81]) {
      box([.4, .065, .2], [-2.32, height, side * .65], "alloy", .014);
      for (let slot = 0; slot < 5; slot++) detailBox([.025, .006, .12], [-2.47 + slot * .074, height + .035, side * .65], "dark");
    }
    // Fuel tank straps, exposed mirror face and air intake.
    for (const offset of [-.2, .2]) detailBox([.035, .29, .18], [-1.9 + offset, .72, side * .64], "dark");
    add(new THREE.CylinderGeometry(.058, .058, .023, 12), "dark", [-1.9, .878, side * .66]);
    for (let vent = 0; vent < 5; vent++) detailBox([.045, .014, .24], [-1.52, 1.51 + vent * .047, side * .45], "dark");
    box([.04, .045, .09], [-3.29, 1.52, side * .632], "amber", .009);
    detailBox([.012, 1.18, .014], [-1.7, 1.74, side * .643], "dark");
  }
  box([.15, .18, 1.33], [-3.51, .85, 0], "alloy", .04);
  box([.04, .43, .77], [-3.473, 1.2, 0], "dark");
  for (let i = 0; i < 6; i++) box([.05, .025, .72], [-3.51, 1.04 + i * .058, 0], "alloy", .005);
  for (const side of [-1, 1]) {
    box([.07, .205, .245], [-3.516, 1.175, side * .49], "dark", .027);
    box([.025, .105, .21], [-3.559, 1.19, side * .49], "lamp", .019);
    box([.025, .045, .21], [-3.559, 1.102, side * .49], "amber", .01);
    box([.035, .065, .125], [-3.592, .854, side * .49], "dark", .016);
    box([.02, .034, .09], [-3.615, .857, side * .49], "lamp", .008);
    add(new THREE.TorusGeometry(.037, .009, 5, 12), "dark", [-3.59, .8, side * .32], [0, Math.PI / 2, 0]);
  }
  for (const side of [-1, 1]) {
    detailBox([.075, .018, .19], [-3.555, 1.21, side * .49], "lamp");
    for (let grille = 0; grille < 9; grille++) detailBox([.04, .04, .012], [-3.53, 1.27, -.32 + grille * .08], "dark");
  }
  box([.035, .092, .26], [-3.595, .91, 0], "trailer", .009);
  detailBox([.04, .012, .18], [-3.619, .91, 0], "dark");
  box([.23, .08, .48], [-2.4, 2.51, 0], "teal");
  box([.14, .045, 1.28], [-3.51, .727, 0], "dark", .008);
  for (let light = 0; light < 5; light++) box([.045, .035, .07], [-3.248, 2.325, -.44 + light * .22], "amber", .009);
  box([.32, .018, .52], [-2.7, 2.338, 0], "dark", .025);
  box([.28, .022, .47], [-2.7, 2.345, 0], "paint", .024);
  const short = variant === "rigid" || variant === "tipper" || variant === "mixer";
  // Short bodies sit immediately behind the cab; retain the original rear axle/body alignment.
  const length = short ? 3.56 : 4.95, center = short ? .285 : 1.19, rear = center + length / 2;
  if (short) {
    for (const side of [-1, 1]) box([rear + 3.38, .18, .14], [(rear - 3.38) / 2, .76, side * .44], "dark", .016);
    for (const x of [-1.48, -.5, .5]) box([.12, .15, .96], [x, .76, 0], "dark", .012);
  } else {
    // Tractor frame and fifth wheel physically connect the tractor to the semitrailer.
    for (const side of [-1, 1]) box([2.1, .19, .14], [-1.52, .76, side * .42], "dark", .016);
    box([.8, .1, .94], [-.94, .92, 0], "alloy", .035);
    add(new THREE.CylinderGeometry(.22, .22, .15, 20), "dark", [-.94, 1, 0]);
    for (const side of [-1, 1]) {
      const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.55, 1.34, side * .25), new THREE.Vector3(-1.36, 1.2, side * .25), new THREE.Vector3(-1.25, 1.34, side * .25)]);
      add(new THREE.TubeGeometry(hose, 8, .025, 6, false), side === 1 ? "teal" : "red", [0, 0, 0]);
    }
  }
  const bodyStyle = options.appearance?.bodyStyle;
  if (bodyStyle !== 'bulk-silo') box([length + .04, .08, 1.46], [center, 1.075, 0], "alloy");
  box([length - .3, .17, .86], [center + .07, .82, 0], "dark");
  if (bodyStyle === 'car-carrier') {
    for (const deck of [1.22, 2.36]) {
      for (const side of [-1, 1]) {
        detailBox([length, .09, .22], [center, deck, side * .49], 'trailer');
        detailBox([length, .08, .055], [center, deck + .13, side * .7], 'teal');
        for (let rib = 0; rib < 21; rib++) detailBox([.055, .015, .23], [center - 2.32 + rib * .23, deck + .053, side * .49], 'dark');
      }
      for (const x of [.02, 2.05]) {
        box([1.62, .24, .83], [x, deck + .3, 0], x < 1 ? 'paint' : 'teal', .09);
        box([.83, .28, .72], [x + .06, deck + .53, 0], x < 1 ? 'paint' : 'teal', .07);
        for (const side of [-1, 1]) {
          detailBox([.62, .19, .015], [x + .06, deck + .54, side * .367], 'glass');
          detailBox([.025, .2, .022], [x + .05, deck + .54, side * .38], 'dark');
          for (const axle of [-.5, .5]) {
            add(new THREE.CylinderGeometry(.13, .13, .105, 16), 'tyre', [x + axle, deck + .14, side * .4], [Math.PI / 2, 0, 0]);
            add(new THREE.CylinderGeometry(.075, .075, .11, 12), 'alloy', [x + axle, deck + .14, side * .405], [Math.PI / 2, 0, 0]);
          }
          detailBox([.026, .065, .18], [x - .812, deck + .32, side * .25], 'lamp');
          detailBox([.026, .06, .17], [x + .812, deck + .32, side * .25], 'red');
          detailBox([.15, .022, .022], [x + .2, deck + .38, side * .429], 'alloy');
        }
        detailBox([.02, .2, .65], [x - .37, deck + .54, 0], 'glass');
        detailBox([.02, .19, .65], [x + .49, deck + .54, 0], 'glass');
      }
    }
    for (const side of [-1, 1]) {
      for (const x of [-1.13, 1.02, 3.5]) detailBox([.08, 1.42, .08], [x, 1.94, side * .7], 'alloy');
      for (const x of [-.08, 2.25]) pipe([[x - .9, 1.24, side * .7], [x + .85, 2.35, side * .7]], .025, 'alloy');
      box([.13, .88, .42], [rear + .11, 1.66, side * .46], 'trailer', .012, [0, 0, -.12]);
      for (let rung = 0; rung < 7; rung++) detailBox([.15, .025, .38], [rear + .14, 1.3 + rung * .11, side * .46], 'dark');
    }
  } else if (bodyStyle === 'livestock') {
    box([length, .09, 1.44], [center, 1.95, 0], 'trailer');
    box([length + .06, .1, 1.46], [center, 2.93, 0], 'trailer', .045);
    for (const side of [-1, 1]) {
      for (const height of [1.3, 1.53, 1.76, 2.12, 2.35, 2.58, 2.8]) detailBox([length, .13, .05], [center, height, side * .7], 'trailer');
      for (let post = 0; post < 9; post++) detailBox([.065, 1.74, .075], [center - length / 2 + .06 + post * .603, 2.04, side * .73], 'alloy');
      detailBox([length, .07, .035], [center, 1.18, side * .75], 'teal');
      pipe([[rear + .1, 1.24, side * .59], [rear + .1, 2.82, side * .59]], .025, 'alloy');
    }
    box([.07, 1.7, 1.4], [center - length / 2, 2.02, 0], 'trailer');
    for (const height of [1.25, 1.52, 1.79, 2.06, 2.33, 2.6, 2.86]) detailBox([.075, .12, 1.4], [rear + .035, height, 0], 'trailer');
    for (const z of [-.64, 0, .64]) detailBox([.09, 1.76, .075], [rear + .07, 2.05, z], 'alloy');
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(.045, .045, .26, 12), 'alloy', [rear + .09, 1.2, side * .45], [Math.PI / 2, 0, 0]);
      box([.065, .26, .06], [rear + .13, 2.1, side * .35], 'dark', .008);
    }
  } else if (bodyStyle === 'crane') {
    box([length, .14, 1.43], [center, 1.2, 0], 'trailer');
    add(new THREE.CylinderGeometry(.46, .46, .19, 24), 'dark', [-.6, 1.38, 0]);
    box([.74, .7, .76], [-.6, 1.78, -.12], 'trailer', .06);
    box([.46, .55, .96], [-1.02, 1.69, -.07], 'dark', .045);
    box([.64, .72, .52], [-.59, 1.86, .55], 'paint', .05);
    detailBox([.035, .43, .44], [-.92, 1.98, .55], 'glass');
    detailBox([.48, .43, .025], [-.59, 1.98, .824], 'glass');
    detailBox([.03, .45, .035], [-.56, 1.98, .843], 'dark');
    box([.52, .08, .6], [-.59, 2.25, .55], 'dark', .015);
    for (const [span, x, height, depth] of [[2.7, .52, .43, .39], [2.22, 1.45, .32, .29], [1.53, 2.42, .23, .2]])
      box([span, height, depth], [x, 2.14 + x * .075, -.12], 'trailer', .025, [0, 0, .075]);
    add(new THREE.CylinderGeometry(.08, .08, 1.5, 12), 'alloy', [.1, 1.83, -.12], [0, 0, -1.04]);
    pipe([[3.18, 2.48, -.12], [3.18, 1.67, -.12]], .014, 'dark');
    add(new THREE.TorusGeometry(.095, .026, 6, 16, Math.PI * 1.65), 'alloy', [3.18, 1.57, -.12]);
    for (const x of [-.85, 2.75]) {
      box([.24, .21, 1.65], [x, 1.04, 0], 'dark', .02);
      for (const side of [-1, 1]) {
        box([.2, .33, .18], [x, .96, side * .76], 'trailer', .02);
        box([.3, .07, .27], [x, .77, side * .76], 'dark', .01);
      }
    }
    for (let panel = 0; panel < 8; panel++) detailBox([.025, .014, 1.26], [center - 1.5 + panel * .56, 1.28, 0], 'alloy');
  } else if (bodyStyle === 'refuse') {
    box([length - .65, 1.28, 1.35], [center - .32, 1.84, 0], 'trailer', .19);
    box([.18, 1.1, 1.39], [center - 1.59, 1.84, 0], 'alloy', .035);
    const hopper = new THREE.Shape();
    hopper.moveTo(rear - 1.02, 1.18); hopper.lineTo(rear + .28, 1.18); hopper.lineTo(rear + .28, 1.91);
    hopper.lineTo(rear - .22, 2.52); hopper.lineTo(rear - 1.02, 2.52); hopper.closePath();
    add(new THREE.ExtrudeGeometry(hopper, { depth: 1.4, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 1 }), 'trailer', [0, 0, -.7]);
    box([.055, .62, 1.02], [rear + .315, 1.6, 0], 'dark', .025);
    for (const side of [-1, 1]) {
      detailBox([length - .7, .09, .035], [center - .25, 1.72, side * .7], 'teal');
      add(new THREE.CylinderGeometry(.055, .07, .77, 12), 'alloy', [rear - .12, 1.85, side * .75], [0, 0, -.43]);
      detailBox([.05, .43, .06], [rear + .37, 1.04, side * .35], 'alloy');
      detailBox([.43, .06, .08], [rear + .54, .85, side * .35], 'alloy');
      pipe([[rear + .36, 1.28, side * .66], [rear + .36, 1.81, side * .66]], .025, 'alloy');
      for (let stripe = 0; stripe < 4; stripe++) detailBox([.08, .2, .035], [rear - .13 + stripe * .1, 2.15, side * .73], stripe % 2 ? 'dark' : 'amber', [0, 0, -.35]);
    }
    box([.14, .15, 1.36], [rear + .33, 1.99, 0], 'alloy', .02);
  } else if (bodyStyle === 'bulk-silo') {
    add(new THREE.CylinderGeometry(.55, .55, length - .35, 28), 'trailer', [center, 2.13, 0], [0, 0, Math.PI / 2]);
    for (const end of [-1, 1]) {
      const cap = new THREE.SphereGeometry(1, 20, 10); cap.scale(.19, .55, .55);
      add(cap, 'trailer', [center + end * (length - .35) / 2, 2.13, 0]);
    }
    for (const x of [center - 1.4, center, center + 1.4]) {
      add(new THREE.CylinderGeometry(.6, .13, .72, 18), 'trailer', [x, 1.41, 0]);
      add(new THREE.CylinderGeometry(.09, .09, .17, 12), 'alloy', [x, .98, 0]);
      pipe([[x, .99, 0], [x, .99, .66]], .065, 'alloy');
      add(new THREE.TorusGeometry(.105, .018, 6, 16), 'red', [x, 1.08, .62], [Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(.17, .17, .075, 16), 'dark', [x, 2.72, 0]);
      for (const side of [-1, 1]) detailBox([.13, .38, .1], [x, 1.05, side * .49], 'alloy');
    }
    for (const side of [-1, 1]) {
      detailBox([length, .13, .13], [center, .95, side * .53], 'alloy');
      pipe([[center - 1.4, 1.12, side * .69], [center + 1.6, 1.12, side * .69], [rear + .1, 1.4, side * .69]], .055, 'alloy');
      detailBox([length - .3, .04, .04], [center, 3, side * .3], 'alloy');
      for (const x of [center - 1.8, center, center + 1.8]) detailBox([.035, .29, .035], [x, 2.85, side * .3], 'alloy');
    }
    detailBox([length - .35, .055, .39], [center, 2.68, 0], 'alloy');
    for (let rung = 0; rung < 8; rung++) detailBox([.045, .025, .47], [rear + .21, 1.27 + rung * .2, 0], 'alloy');
    for (const side of [-1, 1]) pipe([[rear + .21, 1.23, side * .25], [rear + .21, 2.81, side * .25], [rear - .03, 2.91, side * .25]], .025, 'alloy');
  } else if (variant === "tanker") {
    add(new THREE.CylinderGeometry(.66,.66,length-.4,32,1),"trailer",[center,1.89,0],[0,0,Math.PI/2]);
    for(const end of [-1,1]) {
      const cap=new THREE.SphereGeometry(1,24,12);cap.scale(.28,.66,.66);
      add(cap,"trailer",[center+end*(length-.4)/2,1.89,0]);
    }
    for(const x of [center-1.45,center,center+1.45]) {
      add(new THREE.TorusGeometry(.67,.035,6,32),"alloy",[x,1.89,0],[0,Math.PI/2,0]);
      box([.5,.12,.7],[x,2.58,0],"alloy");
      add(new THREE.CylinderGeometry(.17,.17,.06,16),"dark",[x,2.67,0]);
      box([.21, .18, 1.04], [x, 1.23, 0], "dark", .022);
      for (const side of [-1, 1]) box([.23, .25, .13], [x, 1.33, side * .4], "alloy", .018, [side * .35, 0, 0]);
    }
    box([length-.5,.05,.4],[center,2.58,0],"alloy");
    for(const side of [-1,1]) {
      box([length-.6,.04,.035],[center,2.92,side*.3],"alloy");
      for(let step=0;step<7;step++)box([.04,.32,.04],[center-1.8+step*.6,2.76,side*.3],"alloy");
    }
    for(let step=0;step<7;step++)box([.05,.025,.5],[rear+.3,1.3+step*.18,0],"alloy");
    for (const side of [-1, 1]) {
      pipe([[rear + .3, 1.2, side * .27], [rear + .3, 2.58, side * .27], [rear + .06, 2.74, side * .27]], .022, "alloy");
      pipe([[center - 1.2, 1.3, side * .5], [center - 1.2, 1.04, side * .5], [center - .65, 1.04, side * .5]], .042, "alloy");
      add(new THREE.TorusGeometry(.08, .014, 6, 16), "red", [center - .65, 1.04, side * .555]);
    }
  } else if(variant === "mixer") {
    const drumProfile=[[.28,-1.35],[.58,-1.0],[.72,-.48],[.73,.48],[.53,1.05],[.25,1.3]];
    add(new THREE.LatheGeometry(drumProfile.map(([r,h])=>new THREE.Vector2(r,h)),32),"trailer",[center,1.94,0],[0,0,Math.PI/2-.18]);
    add(new THREE.CircleGeometry(.28, 24), "trailer", [center + 1.328, 1.698, 0], [0, Math.PI / 2, -.18]);
    add(new THREE.TorusGeometry(.25, .035, 6, 24), "alloy", [center - 1.28, 2.173, 0], [0, Math.PI / 2, -.18]);
    for(const x of [center-.8,center+.8]) {
      box([.21,.65,1.1],[x,1.38,0],"alloy");
    }
    for(const offset of [-.32,.32])add(new THREE.TorusGeometry(.735,.025,6,32),"teal",[center+offset,1.94-offset*.18,0],[0,Math.PI/2,-.18]);
    box([.6,.45,.66],[rear-.25,1.75,0],"alloy",.06);
    box([1.1,.12,.38],[rear+.13,1.38,0],"alloy",.03,[0,0,-.35]);
    for(let step=0;step<5;step++)box([.3,.025,.12],[rear-.48,1.1+step*.23,.71],"alloy");
    box([.08,1.3,.07],[rear-.67,1.68,.71],"alloy");
    box([.06,1.3,.065],[rear-.3,1.68,.71],"alloy");
    pipe([[rear - .67, 2.2, .71], [rear - .67, 2.42, .71], [rear - .3, 2.42, .71], [rear - .3, 2.2, .71]], .025, "alloy");
    box([.31,.11,.6],[rear-.28,2.05,0],"dark",.025);
    for (const x of [center - .8, center + .8]) for (const side of [-1, 1])
      add(new THREE.CylinderGeometry(.1, .1, .15, 12), "dark", [x, 1.72, side * .48], [Math.PI / 2, 0, 0]);
  } else if(variant === "lowloader") {
    box([1.1,.24,1.4],[-.75,1.19,0],"trailer");
    box([length-1,.2,1.48],[center+.4,.79,0],"trailer");
    box([.9,.18,1.45],[rear-.35,1.13,0],"trailer",.03,[0,0,.29]);
    for(const side of [-1,1]) {
      box([length-1,.07,.06],[center+.4,.93,side*.75],"dark");
      box([.95,.12,.48],[rear+.25,1.2,side*.43],"trailer",.02,[0,0,.18]);
      for(let rib=0;rib<7;rib++)box([.04,.025,.45],[rear-.2+rib*.12,1.31,side*.43],"dark");
      add(new THREE.CylinderGeometry(.045, .045, .5, 12), "alloy", [rear - .19, 1.18, side * .43], [Math.PI / 2, 0, 0]);
      for (let anchor = 0; anchor < 5; anchor++) add(new THREE.TorusGeometry(.043, .01, 5, 12), "alloy", [center - 1.15 + anchor * .8, .92, side * .752], [0, Math.PI / 2, 0]);
    }
  } else if(variant === "logging") {
    box([length,.13,1.42],[center,1.19,0],"alloy");
    for(let rack=0;rack<4;rack++) {
      const x=center-1.8+rack*1.15;
      box([.13,.14,1.55],[x,1.3,0],"teal");
      for(const side of [-1,1])box([.1,1.32,.1],[x,1.9,side*.71],"teal");
    }
    for (let log = 0; log < (options.cargoAccess ? 0 : 5); log++) {
      const y = 1.55 + Math.floor(log / 3) * .36, z = (log % 3 - 1) * .37;
      add(new THREE.CylinderGeometry(.18, .21, length - .34, 12), "trailer", [center, y, z], [0, 0, Math.PI / 2]);
      for (const end of [-1, 1]) {
        const x = center + end * (length - .335) / 2;
        add(new THREE.CircleGeometry(end === -1 ? .18 : .21, 16), "teal", [x, y, z], [0, end * Math.PI / 2, 0]);
        for (const radius of [.07, .13]) add(new THREE.TorusGeometry(radius, .003, 3, 16), "trailer", [x + end * .003, y, z], [0, Math.PI / 2, 0]);
      }
    }
    for (const x of [center - 1.1, center + 1.1]) pipe([[x, 1.25, -.69], [x, 2.1, -.6], [x, 2.1, .6], [x, 1.25, .69]], .02, "dark");
    box([.1,1.36,1.42],[-1.24,1.86,0],"teal");
  } else if (variant === "flatbed") {
    // Open deck and headboard; no enclosed container or invented load.
    box([length, .14, 1.42], [center, 1.18, 0], "trailer");
    box([.1, .85, 1.42], [-1.26, 1.63, 0], "teal");
    for (const side of [-1, 1]) {
      box([length, .09, .04], [center, 1.3, side * .73], "teal", .01);
      for (let i = 0; i < 8; i++) box([.055, .36, .055], [-1.06 + i * .63, 1.34, side * .7], "alloy");
      for (let anchor = 0; anchor < 6; anchor++) add(new THREE.TorusGeometry(.038, .009, 5, 12), "alloy", [center - 1.9 + anchor * .75, 1.12, side * .755]);
    }
    for (let plank = 0; plank < 7; plank++) detailBox([length - .1, .009, .01], [center, 1.254, -.56 + plank * .187], "dark");
    for (let bar = 0; bar < 5; bar++) detailBox([.02, .65, .035], [-1.317, 1.63, -.5 + bar * .25], "alloy");
  } else if (variant === "tipper") {
    // Open, tapered tipping body. The stationary equipment is shown lowered.
    box([length, .12, 1.32], [center, 1.2, 0], "trailer");
    for (const side of [-1, 1]) {
      const wall = new THREE.Shape();
      wall.moveTo(-length / 2 + .25, 1.25); wall.lineTo(length / 2 - .12, 1.25);
      wall.lineTo(length / 2, 2.36); wall.lineTo(-length / 2, 2.36); wall.closePath();
      add(new THREE.ExtrudeGeometry(wall, { depth: .07, bevelEnabled: false }), "trailer", [center, 0, side === 1 ? .68 : -.75]);
      box([length + .06, .07, .1], [center, 2.38, side * .73], "trailer", .015);
      for (let i = 0; i < 6; i++) box([.065, 1.04, .04], [center - 1.35 + i * .52, 1.84, side * .76], "alloy", .01);
    }
    box([.09, 1.1, 1.4], [center - length / 2 + .15, 1.82, 0], "trailer");
    box([.09, 1.1, 1.4], [rear - .03, 1.82, 0], "trailer");
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(.065, .065, .23, 12), "alloy", [rear - .015, 1.29, side * .48], [Math.PI / 2, 0, 0]);
      box([.04, .19, .08], [rear + .026, 2.17, side * .55], "dark", .012);
      box([.08, .23, .1], [center - 1.18, 1.13, side * .39], "alloy", .013, [0, 0, -.24]);
    }
  } else {
    if(options.cargoAccess){
      for(const side of [-1,1])box([length,1.57,.055],[center,1.87,side*.69],"trailer",.015);
      box([length,.065,1.42],[center,2.625,0],"trailer",.015);
      box([length,.1,1.42],[center,1.13,0],"alloy",.015);
      box([.06,1.57,1.42],[center-length/2,1.87,0],"trailer",.015);
    }else box([length, 1.57, 1.42], [center, 1.87, 0], "trailer", .035);
    for (const side of [-1, 1]) {
      box([length - .03, .085, .03], [center, 1.27, side * .725], "teal", .01);
      box([length + .04, .045, .04], [center, 2.65, side * .723], "alloy", .01);
      if (variant === "curtainsider") {
        for(let fold=0;fold<22;fold++)detailBox([.025,1.43,.018],[center-length/2+.15+fold*.218,1.93,side*.719],"paint");
        for(let buckle=0;buckle<12;buckle++) {
          box([.034,.22,.028],[center-length/2+.22+buckle*.4,1.28,side*.74],"dark",.005);
          box([.07,.055,.035],[center-length/2+.22+buckle*.4,1.18,side*.76],"alloy",.005);
        }
        box([length-.3,.08,.025],[center,2.14,side*.747],"teal",.008);
      } else if (variant !== "refrigerated") for (let i = 0; i < (short ? 19 : 29); i++) box([.013, 1.26, .023], [center - length / 2 + .16 + i * .164, 1.99, side * .717], "alloy", .004);
    }
    if(!options.cargoAccess){
    box([.045, 1.46, 1.31], [rear + .025, 1.88, 0], "alloy");
    for (const side of [-1, 1]) {
      box([.03, 1.41, .58], [rear + .057, 1.89, side * .31], "trailer");
      box([.05, 1.27, .025], [rear + .085, 1.89, side * .26], "alloy");
      detailBox([.035, 1.43, .022], [rear + .089, 1.89, side * .62], "dark");
      for (let hinge = 0; hinge < 4; hinge++) {
        box([.065, .052, .12], [rear + .11, 1.35 + hinge * .35, side * .595], "alloy", .007);
        add(new THREE.CylinderGeometry(.023, .023, .085, 8), "alloy", [rear + .145, 1.35 + hinge * .35, side * .637]);
      }
      box([.046, .32, .055], [rear + .096, 1.63, side * .26], "dark", .006);
      box([.042, .045, .16], [rear + .125, 1.73, side * .31], "alloy", .006);
    }
    detailBox([.045, 1.43, .024], [rear + .09, 1.89, 0], "dark");
    for (const height of [1.2, 2.59]) detailBox([.025, .025, 1.22], [rear + .092, height, 0], "teal");
    }
    if (variant === "refrigerated") {
      box([.22, .85, .78], [-1.4, 2.07, 0], "alloy", .08);
      for (const side of [-1, 1]) {
        add(new THREE.CylinderGeometry(.2, .2, .04, 24), "dark", [-1.53, 2.08, side * .2], [0, 0, Math.PI / 2]);
        box([.44, .045, .035], [center, 2.02, side * .736], "teal", .005);
        box([.045, .44, .035], [center, 2.02, side * .736], "teal", .005);
        box([.44, .035, .035], [center, 2.02, side * .736], "teal", .005, [0, 0, Math.PI / 3]);
        box([.44, .035, .035], [center, 2.02, side * .736], "teal", .005, [0, 0, -Math.PI / 3]);
      }
    }
  }
  for (const side of [-1, 1]) {
    if (!short) box([.12, .72, .12], [-.6, .65, side * .49], "dark");
    box([1.32, .23, .06], [rear - .885, .58, side * .78], "dark");
    box([.06, .12, .24], [rear + .055, .95, side * .5], "red");
    for (let marker = 0; marker < (short ? 3 : 5); marker++) box([.08, .04, .024], [center - length / 2 + .38 + marker * (length - .76) / (short ? 2 : 4), 1.12, side * .745], "amber", .005);
    box([.075, .05, .1], [rear + .09, .95, side * .51], "lamp", .007);
  }
  box([.13, .12, 1.28], [rear + .015, .65, 0], "alloy");
  box([.025, .09, .26], [rear + .092, .72, 0], "trailer", .007);
  // Stationary wheel arches and mudflaps must stay outside the wheel animation mask.
  const axles = short ? [-2.97, 1.1, 1.65] : [-2.97, -1.39, -.82, 2.2, 2.75, 3.28];
  for (const axle of axles) for (const side of [-1, 1]) {
    const arch = new THREE.Shape();
    arch.absarc(0, 0, .468, .07, Math.PI - .07, false);
    arch.absarc(0, 0, .405, Math.PI - .07, .07, true); arch.closePath();
    add(new THREE.ExtrudeGeometry(arch, { depth: .105, bevelEnabled: false, curveSegments: 12 }), axle === -2.97 ? "paint" : "dark", [axle, .37, side === 1 ? .742 : -.847]);
  }
  for (const axle of [-2.97, axles[axles.length - 1]]) for (const side of [-1, 1])
    box([.035, .3, .23], [axle + .44, .29, side * .71], "tyre", .009);
  // The road preview animates wheel vertices; this is independent of tracking data.
  for (const axle of axles) {
    wheelAxle = axle;
    for (const side of [-1, 1]) {
      const profile = [[.2,-.125],[.285,-.125],[.338,-.112],[.364,-.075],[.369,-.04],[.369,.04],[.364,.075],[.338,.112],[.285,.125],[.2,.125],[.2,-.125]];
      add(new THREE.LatheGeometry(profile.map(([radius,width])=>new THREE.Vector2(radius,width)), 32), "tyre", [axle, .37, side * .68], [Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(.224, .224, .255, 24, 1), "alloy", [axle, .37, side * .69], [Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(.13, .16, .035, 24, 1), "dark", [axle, .37, side * .832], [side * Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(.079, .079, .047, 16, 1), "alloy", [axle, .37, side * .85], [Math.PI / 2, 0, 0]);
      for (let bolt = 0; bolt < 8; bolt++) {
        const angle = bolt * Math.PI / 4;
        add(new THREE.CylinderGeometry(.014, .014, .015, 6), "alloy", [axle + Math.sin(angle) * .105, .37 + Math.cos(angle) * .105, side * .858], [Math.PI / 2, 0, 0]);
      }
      for (let tread = 0; tread < 26; tread++) {
        const angle = tread * Math.PI * 2 / 26;
        for (const strip of [-1,1]) detailBox([.058,.012,.055], [axle + Math.sin(angle) * .369, .37 + Math.cos(angle) * .369, side * .68 + strip * .052], "tyre", [0,0,-angle]);
      }
    }
  }
  // Optional original fittings are merged into existing material batches. They
  // alter the visual assembly only, never an equipment class or cargo capacity.
  const fittings = options.appearance?.fittings ?? [];
  if (fittings.includes('high-roof')) {
    box([.82, .32, 1.1], [-2.75, 2.46, 0], 'paint', .08);
    detailBox([.52, .025, .7], [-2.75, 2.64, 0], 'dark');
  }
  if (fittings.includes('aero')) {
    box([.66, .09, 1.12], [-2.12, 2.54, 0], 'paint', .02, [0, 0, .24]);
    for (const side of [-1, 1]) box([length * .55, .34, .045], [center - .35, .78, side * .66], 'trailer', .015);
  }
  if (fittings.includes('side-guards')) for (const side of [-1, 1]) {
    for (const y of [.62, .82]) detailBox([short ? 1.25 : 1.85, .05, .05], [short ? -.15 : .55, y, side * .77], 'alloy');
    for (const x of [short ? -.6 : -.15, short ? .35 : 1.25]) detailBox([.045, .34, .045], [x, .77, side * .77], 'dark');
  }
  if (fittings.includes('tail-lift')) {
    box([.09, 1.05, 1.18], [rear + .15, 1.57, 0], 'alloy', .012);
    for (const side of [-1, 1]) detailBox([.1, .9, .09], [rear + .22, 1.55, side * .54], 'dark');
    for (let z = -.5; z <= .5; z += .12) detailBox([.012, .94, .014], [rear + .204, 1.57, z], 'dark');
  }
  if (fittings.includes('headboard')) {
    const x = center - length / 2 + .08;
    for (const side of [-1, 1]) detailBox([.07, 1.42, .07], [x, 1.95, side * .68], 'alloy');
    for (const y of [1.5, 2.05, 2.65]) detailBox([.07, .07, 1.42], [x, y, 0], 'alloy');
  }
  if (fittings.includes('beacons')) for (const side of [-1, 1]) {
    detailBox([.19, .04, .17], [-2.62, fittings.includes('high-roof') ? 2.66 : 2.37, side * .39], 'dark');
    add(new THREE.CylinderGeometry(.06, .07, .1, 12), 'amber', [-2.62, fittings.includes('high-roof') ? 2.72 : 2.43, side * .39]);
  }
  if (fittings.includes('cab-guard')) {
    for (const side of [-1, 1]) detailBox([.07, .56, .07], [-3.67, 1, side * .46], 'alloy');
    for (const y of [.78, 1.22]) detailBox([.07, .06, 1.22], [-3.67, y, 0], 'alloy');
  }
  const truck = new THREE.Group(); truck.name = `CargoMesh original ${variant} truck`;
  const wheelAngle = { value: 0 }; wheelAngles.set(truck, wheelAngle);
  if (short) truck.position.x = .8;
  for (const [name, geometries] of pieces) {
    const merged = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    if (!merged) throw new Error("Truck geometry could not be combined");
    const indexed = mergeVertices(merged); merged.dispose();
    const mesh = new THREE.Mesh(indexed, materials[name]); mesh.name = name;
    materials[name].onBeforeCompile = shader => {
      shader.uniforms.wheelAngle = wheelAngle;
      shader.vertexShader = "attribute float wheelAxle; attribute float wheelMask; uniform float wheelAngle;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        float a = wheelAngle * wheelMask;
        mat2 wheelRotation = mat2(cos(a), sin(a), -sin(a), cos(a));
        objectNormal.xy = wheelRotation * objectNormal.xy;`);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec2 pivot = vec2(wheelAxle, .37);
        transformed.xy = wheelRotation * (transformed.xy - pivot) + pivot;`);
    };
    materials[name].customProgramCacheKey = () => "cargomesh-wheel-motion-v1";
    mesh.castShadow = name !== "glass"; mesh.receiveShadow = name !== "glass"; truck.add(mesh);
  }
  truck.userData = { author: "CargoMesh local project", license: "original project asset", decorative: true, componentCount, variant, bodyStyle, designId: options.designId, detailLevel: "cab-finished" };
  if(options.cargoAccess&&!bodyStyle&&["rigid","articulated","refrigerated","curtainsider"].includes(variant)){
    const doors:THREE.Group[]=[];
    for(const side of [-1,1]){
      const door=new THREE.Group();door.name=`Cargo door ${side}`;door.position.set(rear+.055,1.88,side*.66);
      const material=new THREE.MeshStandardMaterial({color:livery.body,metalness:.25,roughness:.48});
      const panel=new THREE.Mesh(new THREE.BoxGeometry(.07,1.44,.66),material);panel.position.z=-side*.33;panel.castShadow=true;door.add(panel);
      const latch=new THREE.Mesh(new THREE.BoxGeometry(.035,1.25,.025),new THREE.MeshStandardMaterial({color:"#b4c7cf",metalness:.75,roughness:.3}));latch.position.set(.055,0,-side*.5);door.add(latch);
      truck.add(door);doors.push(door);
    }
    cargoDoors.set(truck,doors);
  }
  return truck;
}

export function disposeCargoMeshTruck(truck: THREE.Group) {
  wheelAngles.delete(truck);
  cargoDoors.delete(truck);
  truck.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(material => material.dispose()); } });
}
