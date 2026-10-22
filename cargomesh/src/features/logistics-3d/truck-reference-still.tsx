"use client";

import {useEffect,useState} from 'react';

const neutral='/v2-workspace/trucks/reference.svg';

/** Shared by directory, summary and record so the same design keeps the same image. */
export function TruckReferenceStill({designId,photo,fallback=neutral,alt,position='50% 50%'}:{
  designId?:string;photo?:string|null;fallback?:string;alt:string;position?:string;
}){
  const [image,setImage]=useState<{designId:string;src:string}|null>(null);
  useEffect(()=>{
    if(!designId||photo)return;
    let cancelled=false;
    void import('./truck-reference-image').then(module=>module.truckReferenceImage(designId))
      .then(src=>{if(!cancelled)setImage({designId,src});})
      .catch(()=>{/* Keep the neutral image; no retries caused by scroll. */});
    return()=>{cancelled=true;};
  },[designId,photo]);
  const src=photo??(designId?(image?.designId===designId?image.src:neutral):fallback);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={840} height={520} decoding="async" data-reference={!photo&&!!designId} style={{objectPosition:position,objectFit:!photo&&designId?'contain':undefined}} alt={alt}/>;
}
