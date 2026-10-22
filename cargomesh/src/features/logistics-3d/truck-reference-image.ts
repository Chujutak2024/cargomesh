"use client";

import {
  ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, HemisphereLight,
  PerspectiveCamera, PMREMGenerator, Scene, Sphere, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildCargoMeshTruck,disposeCargoMeshTruck} from './truck-model';
import {truckDesign} from './visual-catalog';

const revision='truck-card-v1';
const images=new Map<string,Promise<string>>();
let queue:Promise<unknown>=Promise.resolve();

/** One still per original design, shared by all cards. No card owns a canvas or animation loop. */
export function truckReferenceImage(designId:string):Promise<string>{
  const design=truckDesign(designId);
  if(!design)return Promise.reject(new Error('UNKNOWN_TRUCK_DESIGN'));
  const key=revision+':'+JSON.stringify(design);
  const cached=images.get(key);if(cached)return cached;
  const pending=queue.catch(()=>undefined).then(async()=>{
    try{const stored=sessionStorage.getItem(key);if(stored?.startsWith('data:image/png;base64,'))return stored;}catch{/* Storage is optional. */}
    // Yield between distinct designs; assets sharing a design reuse this same promise.
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    let truck:ReturnType<typeof buildCargoMeshTruck>|null=null;
    let environment:ReturnType<PMREMGenerator['fromScene']>|null=null;
    try{
      renderer.setPixelRatio(1);renderer.setSize(840,520,false);
      renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;
      renderer.setClearColor(0x000000,0);
      const scene=new Scene();
      const generator=new PMREMGenerator(renderer),room=new RoomEnvironment();
      try{environment=generator.fromScene(room,.04,.1,100,{size:128});}
      finally{room.dispose();generator.dispose();}
      scene.environment=environment.texture;scene.environmentIntensity=.65;
      scene.add(new AmbientLight(0xffffff,.45),new HemisphereLight(0xeaf7ff,0x74818b,.8));
      const keyLight=new DirectionalLight(0xffffff,2.4);keyLight.position.set(-3,8,5);
      const fill=new DirectionalLight(0xb5e3ed,1.4);fill.position.set(5,5,-4);scene.add(keyLight,fill);
      truck=buildCargoMeshTruck(design.family,{appearance:design.appearance,designId:design.id});scene.add(truck);
      truck.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(truck),center=bounds.getCenter(new Vector3());
      const radius=bounds.getBoundingSphere(new Sphere()).radius;
      const camera=new PerspectiveCamera(31,840/520,.1,100);
      // Show rear fittings on the lift design and the raised cab in the distribution design.
      const direction=design.appearance.fittings?.includes('tail-lift')?new Vector3(6.5,2.8,7.6)
        :design.appearance.fittings?.includes('high-roof')?new Vector3(-6.5,2,8.5):new Vector3(-6.5,3.1,7.6);
      const distance=radius/Math.sin(camera.fov*Math.PI/360)*1.08;
      camera.position.copy(direction.normalize().multiplyScalar(distance).add(center));camera.lookAt(center);
      renderer.render(scene,camera);
      const image=renderer.domElement.toDataURL('image/png');
      try{sessionStorage.setItem(key,image);}catch{/* The in-memory promise cache remains available. */}
      return image;
    }finally{
      if(truck)disposeCargoMeshTruck(truck);
      environment?.dispose();renderer.dispose();renderer.forceContextLoss();
    }
  });
  images.set(key,pending);queue=pending;
  return pending;
}
