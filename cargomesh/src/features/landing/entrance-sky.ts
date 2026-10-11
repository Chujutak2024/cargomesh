import * as THREE from "three";
import type { TruckEnvironment } from "../logistics-3d/truck-environment";

export function buildEntranceSky(environment: TruckEnvironment) {
  const direction = new THREE.Vector3();
  const uniforms = {
    topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDirection: { value: direction }, night: { value: 0 }, time: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 skyRay;void main(){skyRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 skyRay;uniform vec3 topColor,horizonColor,sunColor,sunDirection;uniform float night,time;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=p*2.03+vec2(7.1,2.3);a*=.5;}return v;}
    void main(){vec3 ray=normalize(skyRay);float elevation=max(0.,ray.y);
    vec3 color=mix(horizonColor,topColor,pow(elevation,.47));vec3 celestial=normalize(sunDirection);
    float facing=max(0.,dot(ray,celestial));float halo=pow(facing,100.);float disc=smoothstep(.99983,.99991,facing);
    color+=sunColor*halo*(.2-night*.12);
    vec3 right=normalize(cross(celestial,vec3(0.,1.,0.))),up=cross(right,celestial);
    vec2 moonUv=vec2(dot(ray,right),dot(ray,up))/.018;
    float crater=fbm(moonUv*19.)*.6+noise(moonUv*45.)*.4;
    float moonLight=.72+.28*sqrt(max(0.,1.-dot(moonUv,moonUv)));
    vec3 moon=vec3(.79,.85,.91)*moonLight*(.7+crater*.4);
    color=mix(color,mix(sunColor*2.2,moon,night),disc);
    vec2 projected=ray.xz/(elevation+.19)*2.3+vec2(time*.0014,0.);
    float density=fbm(projected);float cloud=smoothstep(.49,.70,density);
    cloud*=smoothstep(.01,.17,elevation)*(1.-smoothstep(.78,1.,elevation));
    float sunlit=clamp((density-fbm(projected+vec2(.08,.05)))*5.+.65,0.,1.);
    vec3 cloudShadow=mix(vec3(.51,.63,.69),horizonColor,.38);vec3 cloudLight=mix(vec3(.99,.99,.96),sunColor,.2);
    vec3 cloudColor=mix(cloudShadow,cloudLight,sunlit);cloudColor=mix(cloudColor,vec3(.055,.09,.16),night*.88);
    color=mix(color,cloudColor,cloud*(.84-night*.25));
    vec2 stars=ray.xz/(elevation+.13)*310.;vec2 cell=floor(stars);float seed=hash(cell);
    float star=smoothstep(.995,1.,seed)*pow(max(0.,1.-length(fract(stars)-.5)*2.),5.);
    vec3 starColor=mix(vec3(.62,.79,1.),vec3(1.,.86,.65),hash(cell+4.));
    color+=starColor*star*night*(1.-cloud)*smoothstep(.1,.4,elevation)*(1.3+.18*sin(time*.7+seed*99.));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(750, 36, 24), material); dome.renderOrder = -10;
  const update = (time: number, light: TruckEnvironment) => {
    uniforms.time.value = time; uniforms.night.value = light.night;
    uniforms.topColor.value.set(light.skyTop); uniforms.horizonColor.value.set(light.skyHorizon); uniforms.sunColor.value.set(light.sun);
    // Fixed world azimuth, smooth local-time elevation. Travel does not orbit the sun.
    const elevation = light.blend <= 1 ? .15 - light.blend * .08 : .07 + (light.blend - 1) * .11;
    direction.set(-.45, elevation, .86).normalize();
  };
  update(0, environment);
  return { dome, direction, update, dispose: () => { dome.geometry.dispose(); material.dispose(); } };
}
