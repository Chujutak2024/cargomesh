"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, DataTexture, Fog, Group, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, RepeatWrapping, RGBAFormat, ShaderMaterial, Vector3 } from "three";
import { celestialDirection, type TruckEnvironment } from "./truck-environment";
import { roadPositionAt } from "./road-motion";
import { RoadLandscape } from "./road-landscape";

const lamps = [-30,-10,10,30];
const hills = [[-21,.6,-24,12,3,7],[-5,.3,-28,14,2.5,8],[14,.8,-26,12,3.5,8],[27,.2,-20,10,2.4,7],[-28,.5,21,11,2.8,8],[15,.2,27,18,2.5,9]];

const skyFragment = `
  uniform vec3 top; uniform vec3 horizon; uniform vec3 celestial;
  uniform float night; uniform float sunset; uniform float time;
  varying vec3 direction;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float cloudNoise(vec2 p){
    float value=0.0, weight=.55;
    for(int i=0;i<4;i++){ value+=noise(p)*weight; p=p*2.03+vec2(12.7,9.2); weight*=.48; }
    return value;
  }
  void main(){
    vec3 d=normalize(direction);
    vec3 color=mix(horizon,top,smoothstep(-.05,.35,d.y));
    float angular=acos(clamp(dot(d,celestial),-1.0,1.0));
    float disc=1.0-smoothstep(.026,.030,angular);
    float halo=exp(-angular*angular*95.0)*.32;
    vec3 glow=mix(vec3(1.0,.79,.43),vec3(.63,.78,1.0),night);
    color+=glow*halo*(1.0-night*.7);
    float crater=noise(d.xz*220.0)*.13;
    float lunarShade=.65+.35*smoothstep(-.025,.02,dot(d-celestial,vec3(celestial.z,0.0,-celestial.x)));
    color=mix(color,mix(vec3(3.0,2.3,1.2),vec3(.77,.85,.95)*lunarShade-crater,night),disc);
    vec2 stars=vec2(atan(d.z,d.x)*22.0,asin(d.y)*35.0);
    vec2 cell=floor(stars), offset=fract(stars)-.5;
    float star=(1.0-smoothstep(.012,.045,length(offset)))*step(.87,hash(cell));
    color+=vec3(.66,.79,1.0)*star*night*smoothstep(.02,.16,d.y)*(1.0-disc);
    vec2 cloudUV=d.xz/(max(d.y,.04)+.26)*2.1+vec2(time*.004,0.0);
    float clouds=smoothstep(.53,.70,cloudNoise(cloudUV));
    clouds*=smoothstep(-.01,.08,d.y)*(1.0-smoothstep(.6,.95,d.y));
    vec3 cloudColor=mix(vec3(.92,.95,.97),vec3(.13,.19,.29),night);
    cloudColor=mix(cloudColor,vec3(.94,.67,.51),sunset*.35);
    cloudColor*=.8+.2*noise(cloudUV*5.0);
    color=mix(color,cloudColor,clouds*.82);
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function asphaltTexture() {
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let i=0; i<128*128; i++) {
    const grit = 132 + Math.round(Math.sin(i*127.1)*Math.cos(i*311.7)*35);
    pixels.set([grit,grit,grit,255],i*4);
  }
  const texture = new DataTexture(pixels,128,128,RGBAFormat);
  texture.wrapS=texture.wrapT=RepeatWrapping; texture.repeat.set(100,7);
  texture.generateMipmaps=true; texture.minFilter=LinearMipmapLinearFilter; texture.magFilter=LinearFilter; texture.anisotropy=4; texture.needsUpdate=true;
  return texture;
}

/** Original visual scenery; automatic lighting is independent of GPS and weather services. */
export function RoadEnvironment({environment,moving}: {environment: TruckEnvironment; moving:boolean}) {
  const {scene, invalidate} = useThree();
  const distance=useRef(0), time=useRef(0), marking=useRef<InstancedMesh>(null), roadside=useRef<Group>(null);
  const skyMaterial=useRef<ShaderMaterial>(null);
  const matrix=useMemo(()=>new Matrix4(),[]);
  const asphalt=useMemo(asphaltTexture,[]);
  const sky=useMemo(()=>({top:{value:new Color()},horizon:{value:new Color()},celestial:{value:new Vector3()},night:{value:0},sunset:{value:0},time:{value:0}}),[]);
  useEffect(()=>()=>asphalt.dispose(),[asphalt]);
  useEffect(()=>{
    sky.top.value.set(environment.skyTop); sky.horizon.value.set(environment.skyHorizon);
    sky.night.value=environment.night; sky.sunset.value=1-Math.abs(environment.blend-1);
    const previous=scene.fog; scene.fog=new Fog(environment.skyHorizon,28,65); invalidate();
    return()=>{scene.fog=previous;};
  },[environment,scene,sky,invalidate]);
  useFrame(({gl},delta)=>{
    if(moving){distance.current+=Math.min(delta,.1)*1.1; time.current+=Math.min(delta,.1);}
    const uniforms=skyMaterial.current?.uniforms??sky;
    uniforms.top.value.set(environment.skyTop); uniforms.horizon.value.set(environment.skyHorizon);
    uniforms.night.value=environment.night; uniforms.sunset.value=1-Math.abs(environment.blend-1);
    uniforms.celestial.value.set(...celestialDirection(environment));
    uniforms.time.value=time.current;
    gl.domElement.dataset.sunDirection=uniforms.celestial.value.toArray().map((value:number)=>value.toFixed(3)).join(",");
    asphalt.offset.x=-distance.current/1.2;
    for(let index=0;index<34;index++) marking.current?.setMatrixAt(index,matrix.makeTranslation(-49.5+index*3+distance.current%3,.012,-1.8));
    if(marking.current)marking.current.instanceMatrix.needsUpdate=true;
    roadside.current?.children.forEach(child=>{child.position.x=roadPositionAt(child.userData.startX as number,distance.current);});
    gl.domElement.dataset.roadDistance=distance.current.toFixed(3);
    gl.domElement.dataset.roadMoving=String(moving);
  });
  return <>
    <mesh renderOrder={-1}><sphereGeometry args={[75,24,16]}/>
      <shaderMaterial ref={skyMaterial} side={BackSide} depthWrite={false} uniforms={sky}
        vertexShader="varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }"
        fragmentShader={skyFragment}/>
    </mesh>
    <ambientLight intensity={environment.ambient}/><hemisphereLight args={[environment.skyHorizon,environment.land,.85]}/>
    <directionalLight position={environment.blend<1?[-8,12,6]:[-10,6,5]} intensity={environment.key} color={environment.sun}
      castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-.0005} shadow-normalBias={.018}/>
    <directionalLight position={[6,7,-5]} intensity={environment.fill} color={environment.night>.5?"#9eb9ed":"#c1deed"}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.07,0]} receiveShadow><planeGeometry args={[140,140]}/><meshStandardMaterial color={environment.land} roughness={1}/></mesh>
    <mesh position={[0,-.034,-1.8]} receiveShadow><boxGeometry args={[120,.055,7.4]}/><meshStandardMaterial color="#43505b" map={asphalt} roughness={.94}/></mesh>
    {[-5.8,2.2].map(z=><mesh key={z} position={[0,-.035,z]} receiveShadow><boxGeometry args={[120,.05,.6]}/><meshStandardMaterial color="#a49e89" roughness={1}/></mesh>)}
    {[-5.18,1.58].map(z=><mesh key={z} position={[0,.009,z]}><boxGeometry args={[120,.016,.1]}/><meshStandardMaterial color="#eee7d2" roughness={.9}/></mesh>)}
    <instancedMesh ref={marking} args={[undefined,undefined,34]}><boxGeometry args={[1.4,.016,.12]}/><meshStandardMaterial color="#eee7d2" roughness={.9}/></instancedMesh>
    {hills.map(([x,y,z,sx,sy,sz],index)=><mesh key={index} position={[x,y-2,z]} scale={[sx,sy,sz]}><sphereGeometry args={[1,20,12]}/><meshStandardMaterial color={environment.hills} roughness={1}/></mesh>)}
    <RoadLandscape environment={environment} moving={moving}/>
    <group ref={roadside}>
      {lamps.map((x,index)=><group key={`lamp-${index}`} position={[x,0,-6]} userData={{startX:x}}>
        <mesh position={[0,2.6,0]}><cylinderGeometry args={[.035,.07,5.2,8]}/><meshStandardMaterial color="#60717e" metalness={.75} roughness={.4}/></mesh>
        <mesh position={[0,5.16,.8]}><boxGeometry args={[.07,.07,1.6]}/><meshStandardMaterial color="#60717e" metalness={.75} roughness={.4}/></mesh>
        <mesh position={[0,5.1,1.5]}><boxGeometry args={[.42,.09,.7]}/><meshStandardMaterial color="#efdab0" emissive="#ffd697" emissiveIntensity={environment.night*2.4}/></mesh>
        {index===1||index===2?<pointLight position={[0,4.85,1.5]} color="#ffd6a0" intensity={environment.night*15} distance={13} decay={2}/>:null}
      </group>)}
      {Array.from({length:24},(_,index)=><mesh key={`post-${index}`} position={[-34.5+index*3,.38,-6.25]} userData={{startX:-34.5+index*3}}>
        <boxGeometry args={[.09,.7,.09]}/><meshStandardMaterial color="#a9b4ba" metalness={.7} roughness={.4}/>
      </mesh>)}
    </group>
    <mesh position={[0,.68,-6.25]}><boxGeometry args={[80,.17,.1]}/><meshStandardMaterial color="#a9b4ba" metalness={.7} roughness={.4}/></mesh>
  </>;
}
