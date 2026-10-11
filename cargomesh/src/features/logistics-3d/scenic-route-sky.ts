import * as THREE from "three";
import { celestialDirection, type TruckEnvironment } from "./truck-environment";

/** Atmospheric dome in world orientation: clouds drift slowly, the sun never orbits the truck. */
export function buildScenicRouteSky(environment: TruckEnvironment) {
  const direction = (light: TruckEnvironment) => { const value = new THREE.Vector3(...celestialDirection(light)); value.y *= 1 + 3 * (1 - Math.min(light.blend, 1)); return value.normalize(); };
  const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {
    topColor: { value: new THREE.Color(environment.skyTop) }, horizonColor: { value: new THREE.Color(environment.skyHorizon) },
    sunColor: { value: new THREE.Color(environment.sun) }, sunDirection: { value: direction(environment) },
    night: { value: environment.night }, time: { value: 0 },
  }, vertexShader: `varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec3 skyDirection;uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 sunColor;uniform vec3 sunDirection;uniform float night;uniform float time;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.04+vec2(7.1,2.3);a*=.5;}return v;}
    void main(){vec3 direction=normalize(skyDirection);float elevation=max(0.,direction.y);
    vec3 color=mix(horizonColor,topColor,pow(elevation,.35));
    float facing=max(0.,dot(direction,normalize(sunDirection)));float halo=pow(facing,130.);float disc=smoothstep(.9993,.99965,facing);
    color+=sunColor*halo*(.13-night*.06);color=mix(color,sunColor*(1.8-night*.7),disc);
    vec2 projected=direction.xz/(elevation+.22)*2.7+vec2(time*.0025,0.);
    float cloud=smoothstep(.55,.76,fbm(projected));cloud*=smoothstep(.015,.16,elevation)*(1.-smoothstep(.8,1.,elevation));
    float shade=fbm(projected+vec2(.08,.05));vec3 cloudColor=mix(vec3(.60,.68,.72),vec3(.95,.97,.96),shade);
    cloudColor=mix(cloudColor,vec3(.09,.14,.23),night*.8);color=mix(color,cloudColor,cloud*(.83-night*.22));
    vec2 stars=direction.xz/(elevation+.1)*260.;vec2 cell=floor(stars);float sparkle=smoothstep(.9975,1.,hash(cell))*pow(max(0.,1.-length(fract(stars)-.5)*2.),4.);
    color+=vec3(.65,.79,1.)*sparkle*night*(1.-cloud)*smoothstep(.12,.4,elevation)*1.4;
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 20), material); dome.renderOrder = -10;
  return { dome, direction: material.uniforms.sunDirection.value as THREE.Vector3, update: (time: number, light: TruckEnvironment) => {
    material.uniforms.time.value = time; material.uniforms.night.value = light.night;
    material.uniforms.topColor.value.set(light.skyTop); material.uniforms.horizonColor.value.set(light.skyHorizon);
    material.uniforms.sunColor.value.set(light.sun); material.uniforms.sunDirection.value.copy(direction(light));
  }, dispose: () => { dome.geometry.dispose(); material.dispose(); } };
}
