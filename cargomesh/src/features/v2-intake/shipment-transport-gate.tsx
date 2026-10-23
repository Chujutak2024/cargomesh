"use client";

import {useId,useRef,type ReactNode} from 'react';
import {AnimatePresence,motion,useIsPresent} from 'motion/react';
import {ArrowRight,Plane,Ship,Truck} from 'lucide-react';
import {useIntakeSession} from './intake-session';
import {PRODUCT_MOTION} from '@/features/product-motion/content-motion';
import {useReducedMotionPreference} from '@/features/product-motion/use-motion-preference';
import styles from './shipment-transport-gate.module.css';

/** Presentation entry only. The existing request contract still supports ROAD alone. */
export function ShipmentTransportGate({children}:{children:ReactNode}){
 const {roadTransportSelected}=useIntakeSession();
 return <AnimatePresence mode="wait" initial={false}>
  {roadTransportSelected?<RequestReveal key="road-request">{children}</RequestReveal>:<TransportChoices key="transport-choices"/>}
 </AnimatePresence>;
}

function RequestReveal({children}:{children:ReactNode}){
 const {t}=useIntakeSession(),present=useIsPresent(),reduced=useReducedMotionPreference(),form=useRef<HTMLDivElement>(null);
 return <motion.div ref={form} tabIndex={-1} className={styles.form} inert={!present} aria-hidden={!present||undefined}
   aria-label={t('Datos del envío terrestre','Road shipment details')}
   initial={{opacity:reduced?1:0,y:reduced?0:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-8}}
   transition={{duration:reduced?0:PRODUCT_MOTION.panel,ease:PRODUCT_MOTION.ease}}
   onAnimationComplete={()=>{const node=form.current;if(present&&node&&!node.closest('[inert]'))node.focus({preventScroll:true});}}>
   {children}
  </motion.div>;
}

function TransportChoices(){
 const {t,selectRoadTransport}=useIntakeSession(),present=useIsPresent(),reduced=useReducedMotionPreference();
 const title=useId(),heading=useRef<HTMLHeadingElement>(null);
 const modes=[
  {id:'road',title:t('Terrestre','Road'),subtitle:t('Camiones · Carriers','Trucks · Carriers'),description:t('Prepara tu carga y consulta transportistas.','Prepare your cargo and find carriers.'),Icon:Truck,available:true},
  {id:'air',title:t('Aéreo','Air'),subtitle:t('Aviones de carga','Cargo aircraft'),description:t('Envíos por transporte aéreo.','Shipments by air transport.'),Icon:Plane,available:false},
  {id:'sea',title:t('Marítimo','Sea'),subtitle:t('Barcos de carga','Cargo ships'),description:t('Envíos por transporte marítimo.','Shipments by sea transport.'),Icon:Ship,available:false},
 ];
 return <motion.section className={styles.picker} aria-labelledby={title} inert={!present} aria-hidden={!present||undefined}
  initial={{opacity:1,y:0}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-10}}
  transition={{duration:reduced?0:PRODUCT_MOTION.interaction,ease:PRODUCT_MOTION.ease}}
  onAnimationComplete={()=>{const node=heading.current;if(present&&node&&!node.closest('[inert]'))node.focus({preventScroll:true});}}>
  <header className={styles.heading}><h2 ref={heading} tabIndex={-1} id={title}>{t('¿Cómo quieres enviar tu carga?','How would you like to ship?')}</h2>
   <p>{t('Elige el medio de transporte para empezar.','Choose a transport mode to get started.')}</p></header>
  <div className={styles.grid}>{modes.map(({id,title,subtitle,description,Icon,available})=><button key={id} type="button"
   className={styles.choice} data-mode={id} disabled={!available} onClick={available?selectRoadTransport:undefined}>
   <span className={styles.choiceTop}><span className={styles.icon}><Icon size={30} strokeWidth={1.6} aria-hidden="true"/></span>
    <span className={styles.badge}>{available?t('Disponible','Available'):t('No disponible','Unavailable')}</span></span>
   <span className={styles.title}>{title}</span><span className={styles.subtitle}>{subtitle}</span>
   <span className={styles.description}>{description}</span>
   <span className={styles.action}>{available?t('Continuar con terrestre','Continue with road'):t('No disponible por ahora','Currently unavailable')}{available?<ArrowRight size={17} aria-hidden="true"/>:null}</span>
  </button>)}</div>
 </motion.section>;
}
