"use client";
import styles from "./conversation-chat.module.css";
import {useState} from "react";
import type {IntakeOptionsData} from "./contracts";
import type {DateClarification} from "./capture-clarification";
import {validExplicitWindow} from "./capture-clarification";
export function DateClarificationPanel({pending,language,onConfirm,onDiscard}:{pending:DateClarification;language:"es"|"en";onConfirm:(role:"pickup"|"delivery",start:string,end:string)=>void;onDiscard:()=>void}){
 const [role,setRole]=useState<"pickup"|"delivery"|"">(''),[start,setStart]=useState(''),[end,setEnd]=useState('');const es=language==='es';
 return <section className={styles.actionReview} aria-label={es?'Aclarar fechas':'Clarify dates'}><h3>{es?'Confirma una ventana concreta':'Confirm an exact window'}</h3>
  <p>{es?'Fecha de referencia':'Reference date'}: {pending.referenceDate} · {pending.timeZone}. {pending.alternatives.join(' / ')}</p>
  <label>{es?'Estas fechas corresponden a':'These dates are for'}<select value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="">{es?'Elige el propósito':'Choose purpose'}</option><option value="pickup">{es?'Recojo':'Pickup'}</option><option value="delivery">{es?'Entrega':'Delivery'}</option></select></label>
  <label>{es?'Desde (hora de la sesión)':'From (session time)'}<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
  <label>{es?'Hasta (hora de la sesión)':'Until (session time)'}<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
  <button type="button" disabled={!role||!validExplicitWindow(start,end)} onClick={()=>{if(role&&validExplicitWindow(start,end))onConfirm(role,start,end);}}>{es?'Confirmar esta ventana':'Confirm this window'}</button>
  <button type="button" onClick={onDiscard}>{es?'Descartar propuesta de fechas':'Discard date proposal'}</button>
 </section>;
}
export function CargoClassificationPanel({options,language,onConfirm}:{options:IntakeOptionsData;language:"es"|"en";onConfirm:(code:string,product:string)=>void}){
 const [product,setProduct]=useState(''),[category,setCategory]=useState(''),[consent,setConsent]=useState(false);const es=language==='es';
 return <section className={styles.actionReview} aria-label={es?'Revisar tipo de mercancía':'Review cargo classification'}><h3>{es?'¿Qué producto transportas?':'What product are you shipping?'}</h3>
  <p>{es?'Un pallet es embalaje, no una categoría de mercancía. No confirmaré peligrosidad ni la cambiaré a carga general por mi cuenta. La clasificación puede requerir documentos y revisión adicional.':'A pallet is packaging, not a cargo category. I will not confirm hazardous status or switch to general cargo myself. Classification may need documents and additional review.'}</p>
  <label>{es?'Producto y condiciones':'Product and conditions'}<textarea value={product} maxLength={200} onChange={e=>{setProduct(e.target.value);setConsent(false);}}/></label>
  <label>{es?'Categoría del catálogo':'Catalog category'}<select value={category} onChange={e=>{setCategory(e.target.value);setConsent(false);}}><option value="">{es?'Selecciona tras revisar el producto':'Select after reviewing the product'}</option>{options.cargoCategories.map(item=><option key={item.code} value={item.code}>{es?item.labelEs:item.labelEn}</option>)}</select></label>
  <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{es?'He revisado el producto y esta categoría.':'I reviewed this product and category.'}</label>
  <button type="button" disabled={!consent||product.trim().length<3||!options.cargoCategories.some(c=>c.code===category)} onClick={()=>{if(consent&&product.trim().length>=3&&options.cargoCategories.some(c=>c.code===category))onConfirm(category,product.trim());}}>{es?'Aplicar clasificación revisada':'Apply reviewed classification'}</button>
 </section>;
}
