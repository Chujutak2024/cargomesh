import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { scenicRoadPose, type RouteLandscape, type ScenicRoadCurve, type continuousScenicRoad } from "./scenic-route-model";

const palette = { grass: "#608344", leaf: "#285c37", leafLight: "#57853d", pine: "#284f45", bark: "#77604a", asphalt: "#394249", curb: "#bebeb0", white: "#eee9d7", amber: "#efb747", metal: "#9aa8a9", wall: "#eadac4", ochre: "#c99764", roof: "#a9553b", blue: "#708e96", window: "#294454", teal: "#14675a", rock: "#77786b", sand: "#d9c29a", flower: "#eac666", dark: "#384039" };
type Kind = keyof typeof palette;
const smooth = (a: number, b: number, v: number) => { const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function terrainHeight(x: number, z: number, offset: number, landscape: RouteLandscape) {
  if (landscape === "coast" && offset < -31) return -1.4;
  const bank = smooth(20, 85, Math.abs(offset)), relief = Math.sin(x * .013 + .7) * Math.cos(z * .009) + .45 * Math.sin(z * .031 + x * .012);
  if (landscape === "coast" && offset < -9) return -.13 - smooth(14, 31, -offset) * .9;
  return -.13 + bank * (.8 + relief * relief * (landscape === "mountains" ? 14 : landscape === "city" ? .3 : 4));
}
/** Locally generated deterministic grain; no downloads or model generation service. */
function grainTexture(color: THREE.Color, seed: number, strength = .18) {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; const factor = 1 + ((seed % 1000) / 1000 - .5) * strength; data.set([Math.min(255, color.r * 255 * factor), Math.min(255, color.g * 255 * factor), Math.min(255, color.b * 255 * factor), 255], i); }
  const texture = new THREE.DataTexture(data, size, size); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4; texture.needsUpdate = true; return texture;
}
export function scenicRoadRibbon(curve: ScenicRoadCurve, width: number, offset = 0, y = .03, uvStart = 0) {
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [], length = curve.getLength(), segments = Math.max(32, Math.ceil(length * 1.4));
  for (let i = 0; i <= segments; i++) {
    const { center, normal } = scenicRoadPose(curve, i / segments);
    for (const side of [-1, 1]) { const p = center.clone().addScaledVector(normal, offset + width / 2 * side); vertices.push(p.x, center.y + y, p.z); uvs.push(side === -1 ? 0 : 1, (uvStart + i / segments * length) / 7); }
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function scenicTerrainElevation(road: ReturnType<typeof continuousScenicRoad>, landscape: RouteLandscape, x: number, z: number) { return terrainHeight(x, z, road.offsetAt(x, z), landscape); }
/** A regular world grid stays unfolded even beside hairpins; one bounded patch covers the fog. */
function terrainGeometryBuilder(road: ReturnType<typeof continuousScenicRoad>, origin: THREE.Vector3, landscape: RouteLandscape) {
  const vertices: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [], offsets: number[] = [], rows = 120, columns = 120;
  const grass = new THREE.Color(landscape === "coast" ? "#789b53" : "#648549"), earth = new THREE.Color("#8e9566"), sand = new THREE.Color(palette.sand);
  let row = 0;
  const fill = (until: number) => { for (; row < Math.min(until, rows + 1); row++) {
    for (let column = 0; column <= columns; column++) {
      const px = (column / columns - .5) * 1440, pz = (row / rows - .5) * 1440, x = px + origin.x, z = pz + origin.z, offset = road.offsetAt(x, z);
      vertices.push(px, terrainHeight(x, z, offset, landscape), pz); uvs.push(x / 13, z / 13); offsets.push(offset);
      const variation = .15 + .26 * (Math.sin(x * .025) * Math.sin(z * .018) + 1) / 2;
      const color = landscape === "coast" && offset < -10 ? sand.clone() : grass.clone().lerp(earth, variation); colors.push(color.r, color.g, color.b);
      if (row < rows && column < columns) { const n = row * (columns + 1) + column; indices.push(n, n + columns + 1, n + 1, n + 1, n + columns + 1, n + columns + 2); }
    }
  } };
  return { fill, finish: () => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute("roadOffset", new THREE.Float32BufferAttribute(offsets, 1)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry; } };
}
export function scenicTerrainGeometry(road: ReturnType<typeof continuousScenicRoad>, origin: THREE.Vector3, landscape: RouteLandscape) {
  const builder = terrainGeometryBuilder(road, origin, landscape); builder.fill(121); return builder.finish();
}
function waterMaterial(origin: THREE.Vector3) {
  return new THREE.ShaderMaterial({ fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, coordinateOrigin: { value: origin.clone() }, deep: { value: new THREE.Color("#247b98") }, shallow: { value: new THREE.Color("#69b8ad") } }]),
    vertexShader: `uniform float time;uniform vec3 coordinateOrigin; attribute float roadOffset; varying vec3 waterPosition; varying float waterShore;
      #include <fog_pars_vertex>
      void main(){waterShore=roadOffset;vec3 p=position;p.y=-.48;waterPosition=p+coordinateOrigin;p.y+=sin(waterPosition.x*.12+waterPosition.z*.16-time*1.3)*.055;
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time;uniform vec3 deep;uniform vec3 shallow;varying vec3 waterPosition;varying float waterShore;
      #include <fog_pars_fragment>
      void main(){if(waterShore>-31.)discard;float ripple=sin(waterPosition.x*.61+waterPosition.z*.37-time*1.9)*sin(waterPosition.z*.29-time*.8);
      float shore=1.-smoothstep(31.,65.,-waterShore);vec3 c=mix(deep,shallow,shore*.85);c+=vec3(.10,.14,.12)*pow(max(0.,ripple),10.);
      c=mix(c,vec3(.79,.86,.76),shore*.3*pow(max(0.,sin(waterPosition.z*.2-time)),4.));gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }` });
}
function assembleTerrain(geometry: THREE.BufferGeometry, origin: THREE.Vector3, landscape: RouteLandscape) {
  const root = new THREE.Group(), grain = grainTexture(new THREE.Color("#d4d5b3").convertLinearToSRGB(), 643, .13);
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 1, map: grain, bumpMap: grain, bumpScale: .045 })); ground.receiveShadow = true; root.add(ground);
  const water = landscape === "coast" ? waterMaterial(origin) : null; if (water) root.add(new THREE.Mesh(geometry, water));
  return { root, origin, update: (time: number) => { if (water) water.uniforms.time.value = time; } };
}
function terrainOrigin(road: ReturnType<typeof continuousScenicRoad>, cursor: number) { const center = road.centerAt(cursor); return new THREE.Vector3(Math.round(center.x / 12) * 12, 0, Math.round(center.z / 12) * 12); }
export function buildScenicRouteTerrain(road: ReturnType<typeof continuousScenicRoad>, landscape: RouteLandscape, cursor: number) {
  const origin = terrainOrigin(road, cursor); return assembleTerrain(scenicTerrainGeometry(road, origin, landscape), origin, landscape);
}
/** Prepare the next field in small frame batches while the current field stays visible. */
export function prepareScenicRouteTerrain(road: ReturnType<typeof continuousScenicRoad>, landscape: RouteLandscape, cursor: number) {
  const origin = terrainOrigin(road, cursor), builder = terrainGeometryBuilder(road, origin, landscape);
  let frame = 0, row = 0, resolveResult: (result: ReturnType<typeof buildScenicRouteTerrain> | null) => void;
  const promise = new Promise<ReturnType<typeof buildScenicRouteTerrain> | null>(resolve => {
    resolveResult = resolve;
    const step = () => { row += 6; builder.fill(row); if (row >= 121) resolve(assembleTerrain(builder.finish(), origin, landscape)); else frame = requestAnimationFrame(step); };
    frame = requestAnimationFrame(step);
  });
  return { promise, cancel: () => { cancelAnimationFrame(frame); resolveResult(null); } };
}
function directionTexture(destination: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 192; const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#17694f"; ctx.fillRect(0, 0, 512, 192); ctx.strokeStyle = "#ecf2d9"; ctx.lineWidth = 7; ctx.strokeRect(12, 12, 488, 168);
  ctx.fillStyle = "#f9f5df"; ctx.font = "600 42px Arial"; ctx.fillText(destination.split(",")[0].slice(0, 19), 33, 92, 348); ctx.font = "22px Arial"; ctx.fillText("CONTINÚA", 34, 141); ctx.font = "70px Arial"; ctx.fillText("↑", 406, 122);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
/** Bounded section: merge scenery by material, share exact road and terrain boundaries. */
export function buildScenicRouteWorld(curve: ScenicRoadCurve, landscape: RouteLandscape, options: { origin?: THREE.Vector3; start?: number; destination?: string; heightAt?: (x: number, z: number) => number; guide?: boolean; signs?: boolean; trees?: boolean } = {}) {
  const root = new THREE.Group(), pools = new Map<Kind, THREE.BufferGeometry[]>(), length = curve.getLength(), origin = options.origin ?? new THREE.Vector3(), start = options.start ?? 0;
  const add = (geometry: THREE.BufferGeometry, kind: Kind, at: THREE.Vector3, rotation = 0, scale = new THREE.Vector3(1, 1, 1), pitch = 0) => {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry; if (plain !== geometry) geometry.dispose(); plain.applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, rotation, 0, "YXZ")), scale)); const list = pools.get(kind) ?? []; list.push(plain); pools.set(kind, list);
  };
  const box = (kind: Kind, p: THREE.Vector3, width: number, height: number, depth: number, yaw = 0, pitch = 0) => add(new THREE.BoxGeometry(width, height, depth), kind, p, yaw, new THREE.Vector3(1, 1, 1), pitch);
  const asphalt = grainTexture(new THREE.Color("#9da3a5").convertLinearToSRGB(), 871, .2); asphalt.repeat.set(4, 1);
  const road = new THREE.Mesh(scenicRoadRibbon(curve, 11, 0, .03, start), new THREE.MeshStandardMaterial({ color: palette.asphalt, roughness: .94, map: asphalt, bumpMap: asphalt, bumpScale: .055 })); road.receiveShadow = true; root.add(road);
  for (const offset of [-5.85, 5.85]) { const verge = new THREE.Mesh(scenicRoadRibbon(curve, .7, offset, .015, start), new THREE.MeshStandardMaterial({ color: palette.curb, roughness: 1, bumpMap: asphalt, bumpScale: .045 })); verge.receiveShadow = true; root.add(verge); }
  const lineMaterial = new THREE.MeshStandardMaterial({ color: palette.white, roughness: .8 }); for (const offset of [-5.05, 5.05]) root.add(new THREE.Mesh(scenicRoadRibbon(curve, .13, offset, .057, start), lineMaterial));
  const guideMaterial = new THREE.MeshStandardMaterial({ color: "#36dcd3", emissive: "#008e81", emissiveIntensity: .8, roughness: .4 }); if (options.guide !== false) root.add(new THREE.Mesh(scenicRoadRibbon(curve, .28, 2.5, .078, start), guideMaterial));
  else guideMaterial.dispose();
  if (landscape !== "city") for (const side of landscape === "mountains" ? [-1, 1] : [-1]) for (const height of [.74, .96]) root.add(new THREE.Mesh(scenicRoadRibbon(curve, .18, side * 7.4, height, start), new THREE.MeshStandardMaterial({ color: "#aeb7ad", metalness: .72, roughness: .37 })));
  for (let station = Math.ceil(start / 8); station < Math.ceil((start + length) / 8); station++) {
    const { center, normal, tangent } = scenicRoadPose(curve, (station * 8 - start) / length), yaw = Math.atan2(tangent.x, tangent.z);
    const random = (salt: number) => { const v = Math.sin(station * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };
    const at = (offset: number, forward = 0, lift = 0) => { const p = center.clone().addScaledVector(normal, offset).addScaledVector(tangent, forward); p.y = (options.heightAt?.(p.x + origin.x, p.z + origin.z) ?? terrainHeight(p.x + origin.x, p.z + origin.z, offset, landscape)) + lift; return p; };
    box("amber", center.clone().setY(.065), .13, .025, 3, yaw);
    for (const side of [-1, 1]) {
      const marker = at(side * 6.65, 0, .53); box("white", marker, .13, 1.1, .16, yaw); box("amber", marker.clone().add(new THREE.Vector3(0, .31, 0)), .14, .14, .18, yaw);
      if (landscape !== "city" && (side === -1 || landscape === "mountains")) box("metal", at(side * 7.4, 0, .47), .12, 1.03, .16, yaw);
      const tree = at(side * (12 + random(1 + side) * 12));
      if (options.trees !== false && (landscape !== "city" || station % 4 === 0)) {
        const height = 4 + random(4 + side) * 3;
        if (landscape === "mountains") {
          add(new THREE.CylinderGeometry(.12, .24, height, 8), "bark", tree.clone().add(new THREE.Vector3(0, height / 2, 0)));
          for (let crown = 0; crown < 3; crown++) add(new THREE.ConeGeometry(2.1 - crown * .4, 3.9 - crown * .5, 12), "pine", tree.clone().add(new THREE.Vector3(0, height * .58 + crown * 1.3, 0)));
        } else if (landscape === "coast" && station % 5 === 0) {
          for (let part = 0; part < 5; part++) add(new THREE.CylinderGeometry(.12 + part * .015, .16 + part * .015, height / 5 + .05, 10), "bark", tree.clone().add(new THREE.Vector3(part * .13, (part + .5) * height / 5, 0)));
          for (let frond = 0; frond < 9; frond++) {
            const angle = frond * Math.PI * 2 / 9, leaves = new THREE.BufferGeometry(), positions: number[] = [];
            for (let part = 0; part < 5; part++) {
              const point = (u: number, side: number) => new THREE.Vector3(Math.cos(angle) * u * 3.5 - Math.sin(angle) * side * .46 * Math.sin(u * Math.PI), height + Math.sin(u * Math.PI) * .65 - u * .95, Math.sin(angle) * u * 3.5 + Math.cos(angle) * side * .46 * Math.sin(u * Math.PI)).add(tree);
              const a = point(part / 5, -1), b = point(part / 5, 1), c = point((part + 1) / 5, -1), d = point((part + 1) / 5, 1); for (const p of [a, b, c, b, d, c]) positions.push(p.x, p.y, p.z);
            }
            leaves.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); leaves.computeVertexNormals(); leaves.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(positions.length / 3 * 2).fill(0), 2)); add(leaves, frond % 2 ? "leaf" : "leafLight", new THREE.Vector3());
          }
        } else {
          add(new THREE.CylinderGeometry(.16, .32, height * .63, 10), "bark", tree.clone().add(new THREE.Vector3(0, height * .31, 0)));
          for (let crown = 0; crown < 5; crown++) add(new THREE.SphereGeometry(1, 16, 12), crown % 2 ? "leafLight" : "leaf", tree.clone().add(new THREE.Vector3(Math.sin(crown * 2.4) * .95, height * .7 + crown % 3 * .5, Math.cos(crown * 2.4) * .85)), station, new THREE.Vector3(1.6, 1.6 + random(6), 1.4));
        }
      }
      if (station % 2 === 0) {
        add(new THREE.SphereGeometry(.7, 10, 8), "grass", at(side * 10.2, 2, .5), random(8), new THREE.Vector3(1.4, .8, 1));
        for (let tuft = 0; tuft < 5; tuft++) add(new THREE.ConeGeometry(.19, .55, 5), "leafLight", at(side * (8.5 + random(tuft + 40) * 4), -3 + tuft, .2));
        if (station % 6 === 0) for (let flower = 0; flower < 4; flower++) add(new THREE.SphereGeometry(.1, 6, 4), "flower", at(side * 9.6, flower * .32, .55));
      }
      if (station % 5 === 0) add(new THREE.DodecahedronGeometry(1, 1), "rock", at(side * 18, 4, .65), station, new THREE.Vector3(1.3, .65, .8));
      if (station % (landscape === "city" ? 5 : 16) === 0 && !(landscape === "coast" && side === -1)) {
        const b = at(side * (landscape === "city" ? 20 : 26)), height = landscape === "city" ? 8 + random(12) * 12 : 4.4;
        const relative = (x: number, y: number, z = 0) => b.clone().addScaledVector(normal, x).addScaledVector(tangent, z).add(new THREE.Vector3(0, y, 0));
        box(station % 3 ? "wall" : "ochre", relative(0, height / 2), 12, height, 11, yaw); box("curb", relative(0, .12), 15, .24, 14, yaw); box(landscape === "city" ? "dark" : "roof", relative(0, height + .25), 12.7, .45, 11.7, yaw);
        for (let floor = 0; floor < Math.floor(height / 2.6); floor++) for (let w = -1; w <= 1; w++) {
          box("white", relative(-side * 6.06, 1.9 + floor * 2.6, w * 3), .14, 1.6, 1.65, yaw); box("window", relative(-side * 6.15, 1.9 + floor * 2.6, w * 3), .09, 1.37, 1.42, yaw);
          box("metal", relative(-side * 6.21, 1.92 + floor * 2.6, w * 3), .06, .05, 1.47, yaw); box("white", relative(-side * 6.24, 1.09 + floor * 2.6, w * 3), .4, .13, 1.8, yaw);
        }
        box("dark", relative(-side * 6.12, 1.08, 4.4), .14, 2.16, 1.45, yaw); box("roof", relative(-side * 6.95, 2.8, 4.4), 1.9, .17, 2.5, yaw);
        if (landscape === "city") { for (let unit = 0; unit < 2; unit++) { box("white", relative(unit * 3 - 2, height + .85), 1.8, 1.1, 1.5, yaw); box("metal", relative(unit * 3 - 2, height + 1.43), 1.6, .08, 1.3, yaw); } }
        else { for (const direction of [-1, 1]) box("roof", relative(0, height + 1, direction * 2.85), 12.8, .2, 6.1, yaw, direction * .25); box("ochre", relative(3, height + 1.8, 2), .65, 2.4, .7, yaw); for (let panel = 0; panel < 3; panel++) box("blue", relative(panel * 2.3 - 2.3, height + 1.65, 1.2), 2, .08, 2, yaw, .25); }
        for (let fence = -3; fence <= 3; fence++) if (fence !== 1) box("white", at(side * 13.5, fence * 2.2, .8), .12, 1.6, .15, yaw); box("white", at(side * 13.5, -3, 1.05), .1, .13, 7.4, yaw); box("curb", at(side * 16.3, 2.3, .05), 5.4, .12, 2, yaw);
      }
      if (station % (landscape === "city" ? 5 : 12) === 0 && side === 1) {
        const lamp = at(8.6); add(new THREE.CylinderGeometry(.07, .13, 8, 10), "metal", lamp.clone().add(new THREE.Vector3(0, 4, 0))); box("metal", lamp.clone().add(new THREE.Vector3(0, 7.97, 0)), 2.3, .12, .13, yaw); box("white", lamp.clone().add(new THREE.Vector3(0, 7.88, 0)), 1.5, .14, .42, yaw);
      }
    }
  }
  if (options.signs !== false) {
  const signMaterial = new THREE.MeshStandardMaterial({ map: directionTexture(options.destination ?? "Destino"), roughness: .65 });
  for (let station = Math.ceil(start / 144); station < Math.ceil((start + length) / 144); station++) { const pose = scenicRoadPose(curve, (station * 144 - start) / length), sign = pose.center.clone().addScaledVector(pose.normal, 9.4); box("metal", sign.clone().setY(2.7), .16, 5.4, .16); const face = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.7, .12), signMaterial); face.position.copy(sign).setY(4.7); face.rotation.y = Math.atan2(-pose.tangent.x, -pose.tangent.z); face.castShadow = true; root.add(face); }
  }
  for (const [kind, pieces] of pools) { const geometry = mergeGeometries(pieces); pieces.forEach(g => g.dispose()); if (!geometry) continue;
    const material = new THREE.MeshStandardMaterial({ color: palette[kind], roughness: kind === "window" ? .17 : kind === "metal" ? .4 : .9, metalness: kind === "metal" ? .65 : kind === "window" ? .22 : 0, side: kind === "leafLight" || kind === "leaf" ? THREE.DoubleSide : THREE.FrontSide });
    if (kind === "window") { material.emissive.set("#f6ba67"); material.emissiveIntensity = .08; }
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = ["wall", "ochre", "roof", "leaf", "leafLight", "pine", "bark", "metal"].includes(kind); mesh.receiveShadow = true; mesh.name = kind; root.add(mesh);
  }
  root.userData.source = "cargomesh-original-interpretive-landscape";
  return { root, guideMaterial, update: (time: number, night: number) => { guideMaterial.emissiveIntensity = .8 + Math.sin(time * 1.4) * .08; root.children.forEach(child => { if (child instanceof THREE.Mesh && child.name === "window" && child.material instanceof THREE.MeshStandardMaterial) child.material.emissiveIntensity = .08 + night * .7; }); } };
}
export function disposeScenicWorld(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(); root.traverse(node => { if (node instanceof THREE.Mesh) { if (node instanceof THREE.InstancedMesh) node.dispose(); geometries.add(node.geometry); for (const material of Array.isArray(node.material) ? node.material : [node.material]) { materials.add(material); if (material instanceof THREE.MeshStandardMaterial) for (const texture of [material.map, material.bumpMap, material.normalMap, material.roughnessMap]) if (texture) textures.add(texture); } } });
  geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); root.clear();
}
