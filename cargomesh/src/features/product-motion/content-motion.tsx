"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";

import { useReducedMotionPreference } from "./use-motion-preference";

export const PRODUCT_MOTION={fast:.12,interaction:.16,content:.2,panel:.24,ease:[.2,.8,.2,1] as const};

/** Stable subtree: animated attributes change without remounting form/API state. */
export function ContentMotion({identity,children,className,focusOnChange=false}:{identity:string|number;children:ReactNode;className?:string;focusOnChange?:boolean}) {
  const reduced=useReducedMotionPreference(),ref=useRef<HTMLDivElement>(null),previous=useRef(identity),controls=useAnimationControls();
  useEffect(()=>{if(reduced){controls.stop();controls.set({opacity:1,y:0});}if(previous.current!==identity){if(focusOnChange){const title=ref.current?.querySelector<HTMLElement>("h1,h2");title?.focus({preventScroll:true});if(title){const rect=title.getBoundingClientRect();if(rect.top<0||rect.bottom>window.innerHeight)title.scrollIntoView({block:"nearest",behavior:"instant"});}}
    if(!reduced){controls.set({opacity:1,y:6});void controls.start({opacity:1,y:0,transition:{duration:PRODUCT_MOTION.content,ease:PRODUCT_MOTION.ease}});}
    else controls.set({opacity:1,y:0});}previous.current=identity;},[identity,focusOnChange,reduced,controls]);
  return <motion.div ref={ref} className={className} data-motion-region={identity} data-reduced-motion={reduced?"true":"false"} initial={false} animate={controls}>
    {children}
  </motion.div>;
}
