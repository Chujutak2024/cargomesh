import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { createEntranceRoad } from "./entrance-road";

function leafTexture() {
  const size = 64, data = new Uint8Array(size * size * 4);
  const sprig = [-.4, .02, .44].flatMap(v => [-1, 1].map(side => ({ u: side * .24, v, angle: side * -.65, width: .18, length: .38 })));
  sprig.push({ u: 0, v: -.7, angle: 0, width: .14, length: .28 });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / (size - 1) - .5) * 2, v = (y / (size - 1) - .5) * 2;
    let alpha = Math.abs(u) < .014 && v > -.8 && v < .85 ? 255 : 0, shade = .47;
    for (const leaf of sprig) {
      const dx = u - leaf.u, dy = v - leaf.v, across = dx * Math.cos(leaf.angle) - dy * Math.sin(leaf.angle), along = (dx * Math.sin(leaf.angle) + dy * Math.cos(leaf.angle)) / leaf.length;
      const width = leaf.width * Math.pow(Math.max(0, 1 - along * along), .72);
      if (Math.abs(along) < .99 && Math.abs(across) < width) { alpha = 255; shade = .69 + along * .08 + Math.exp(-Math.abs(across) * 95) * .16; }
    }
    const i = (y * size + x) * 4; data.set([shade * 215, shade * 245, shade * 175, alpha], i);
  }
  const texture = new THREE.DataTexture(data, size, size); texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.needsUpdate = true; texture.anisotropy = 4; return texture;
}

/** Instanced leaf canopies and grass, plus actual trunks/branches; bounded per road section. */
export function buildEntranceWoodland(road: ReturnType<typeof createEntranceRoad>, from: number, length: number, origin: THREE.Vector3, heightAt: (x: number, z: number) => number) {
  const root = new THREE.Group(), wood: THREE.BufferGeometry[] = [], leaves: { matrix: THREE.Matrix4; color: THREE.Color }[] = [], grass: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D(), wind = { value: 0 };
  const random = (station: number, salt: number) => { const value = Math.sin(station * 127.1 + salt * 311.7) * 43758.5453; return value - Math.floor(value); };
  const branch = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    const difference = b.clone().sub(a), geometry = new THREE.CylinderGeometry(radius * .65, radius, difference.length(), 9);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), difference.normalize());
    geometry.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), rotation, new THREE.Vector3(1, 1, 1))); wood.push(geometry);
  };
  for (let station = Math.ceil(from / 16); station < Math.ceil((from + length) / 16); station++) {
    const pose = road.poseAt(station * 16);
    for (const side of [-1, 1]) {
      const at = (offset: number, forward = 0) => {
        const p = pose.center.clone().addScaledVector(pose.normal, side * offset).addScaledVector(pose.tangent, forward);
        p.y = heightAt(p.x, p.z); return p.sub(origin);
      };
      for (let row = 0; row < 2; row++) {
        const tree = at(15 + row * 26 + random(station, side + row + 1) * 11, row * 6);
        const height = 6.5 + random(station, side + row + 9) * 4, crown = tree.clone().add(new THREE.Vector3(0, height * .73, 0));
        branch(tree, tree.clone().add(new THREE.Vector3(.15, height * .86, -.1)), .18 + height * .012);
        for (let limb = 0; limb < 5; limb++) {
          const angle = limb * 2.4 + station, a = tree.clone().add(new THREE.Vector3(0, height * (.45 + limb * .07), 0));
          const b = crown.clone().add(new THREE.Vector3(Math.cos(angle) * 1.9, -.4 + limb * .12, Math.sin(angle) * 1.9)); branch(a, b, .08);
        }
        const count = row ? 72 : 160;
        for (let leaf = 0; leaf < count; leaf++) {
          const azimuth = random(station + leaf, side + 41) * Math.PI * 2, elevation = Math.acos(2 * random(station + leaf, side + 53) - 1);
          const radius = 2.4 * Math.cbrt(random(station + leaf, row + 59));
          dummy.position.copy(crown).add(new THREE.Vector3(Math.sin(elevation) * Math.cos(azimuth) * radius, Math.cos(elevation) * radius * 1.3, Math.sin(elevation) * Math.sin(azimuth) * radius));
          dummy.rotation.set(random(station + leaf, 68) * Math.PI, azimuth, random(station + leaf, 70) * Math.PI);
          const size = .9 + random(station + leaf, 81) * .65; dummy.scale.set(size, size * 1.4, size); dummy.updateMatrix();
          leaves.push({ matrix: dummy.matrix.clone(), color: new THREE.Color().setHSL(.25 + random(station + leaf, 77) * .075, .36 + random(station, 90) * .2, .18 + random(station + leaf, 89) * .16) });
        }
      }
      for (let tuft = 0; tuft < 28; tuft++) {
        dummy.position.copy(at(7.8 + random(station + tuft, 101) * 4, random(station + tuft, 108) * 16 - 8)); dummy.position.y += .17;
        dummy.rotation.set(0, random(station + tuft, 103) * Math.PI, .08 * side); dummy.scale.set(.3, .3 + random(station + tuft, 106) * .45, .3); dummy.updateMatrix(); grass.push(dummy.matrix.clone());
      }
    }
  }
  const barkGeometry = mergeGeometries(wood); wood.forEach(geometry => geometry.dispose());
  if (barkGeometry) { const trunks = new THREE.Mesh(barkGeometry, new THREE.MeshStandardMaterial({ color: "#70593e", roughness: 1 })); trunks.castShadow = true; trunks.receiveShadow = true; root.add(trunks); }
  const foliage = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: .5, side: THREE.DoubleSide, roughness: .9 });
  foliage.onBeforeCompile = shader => {
    shader.uniforms.woodlandTime = wind; shader.vertexShader = "uniform float woodlandTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      transformed.x += sin(woodlandTime * .8 + instanceMatrix[3].x * .3 + instanceMatrix[3].z * .2) * .035 * uv.y;`);
  };
  foliage.customProgramCacheKey = () => "entrance-leaf-wind-v1";
  const canopy = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), foliage, leaves.length);
  leaves.forEach((leaf, index) => { canopy.setMatrixAt(index, leaf.matrix); canopy.setColorAt(index, leaf.color); }); canopy.castShadow = true; canopy.receiveShadow = true; root.add(canopy);
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-.16, 0, 0, .16, 0, 0, .02, 1, .09, 0, 0, -.16, 0, 0, .16, -.07, .8, .02], 3)); grassGeometry.computeVertexNormals();
  const meadow = new THREE.InstancedMesh(grassGeometry, new THREE.MeshStandardMaterial({ color: "#638342", side: THREE.DoubleSide, roughness: 1 }), grass.length);
  grass.forEach((matrix, index) => meadow.setMatrixAt(index, matrix)); meadow.receiveShadow = true; root.add(meadow);
  root.userData.leafInstances = leaves.length;
  return { root, update: (time: number) => { wind.value = time; } };
}
