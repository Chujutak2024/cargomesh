"use client";
import {Button,Input,Select,Checkbox} from '@/components/ui';
import {Plus,Trash2} from 'lucide-react';
import {cargoGroups,appendCargoGroup,type DraftCargoGroup} from '../cargo-groups';
import {useIntakeSession} from '../intake-session';
import styles from '../v2-intake-prototype.module.css';
export function CargoGroupsEditor(){
 const {draft,activeOptions,t,updateCargoGroups,errorFor}=useIntakeSession(),groups=cargoGroups(draft);
 const change=<K extends keyof DraftCargoGroup>(id:string,key:K,value:DraftCargoGroup[K])=>updateCargoGroups(groups.map(g=>g.id===id?{...g,[key]:value}:g));
 const numbers=[['unitQuantity','Cantidad','Quantity',1],['unitWeightPerUnitKg','Peso por unidad (kg)','Weight per unit (kg)',0.001],['unitVolumePerUnitM3','Volumen por unidad (m³)','Volume per unit (m³)',0.001],['unitLengthCm','Largo por unidad (cm)','Length per unit (cm)',0.1],['unitWidthCm','Ancho por unidad (cm)','Width per unit (cm)',0.1],['unitHeightCm','Alto por unidad (cm)','Height per unit (cm)',0.1]] as const;
 return <section className={styles.formSection}><header className={styles.formSectionHeader}><h3>{t('Grupos de carga','Cargo groups')}</h3><Button type="button" variant="secondary" disabled={groups.length>=20} onClick={()=>updateCargoGroups(appendCargoGroup(draft))}><Plus size={16}/>{t('Añadir grupo','Add group')}</Button></header>
 <p>{t('Añade cajas y pallets por separado. Categoría y requisitos se aplican a todos los grupos. Las medidas son por unidad.','Add boxes and pallets separately. Category and requirements apply to all groups. Measurements are per unit.')}</p>
 {groups.map((g,index)=><fieldset key={g.id} className={styles.cargoGroup}><legend>{t('Grupo','Group')} {index+1}</legend><div className={styles.cargoGroupHeading}><Button type="button" variant="ghost" disabled={groups.length===1} aria-label={t('Eliminar grupo ','Remove group ')+(index+1)} onClick={()=>updateCargoGroups(groups.filter(row=>row.id!==g.id))}><Trash2 size={15}/>{t('Eliminar','Remove')}</Button></div><div className={styles.formGrid}>
 <Select label={t('Tipo de paquete','Package type')} value={g.unitPackageType} onChange={e=>change(g.id,'unitPackageType',e.target.value)}><option value="">{t('Seleccionar','Select')}</option>{activeOptions.packagingOptions.map(o=><option value={o.code} key={o.code}>{t(o.labelEs,o.labelEn)}</option>)}</Select>
 {numbers.map(([key,es,en,step])=><Input key={key} label={t(es,en)} type="number" min={step} step={step} value={g[key]} error={index===0?errorFor(key):undefined} onChange={e=>change(g.id,key,e.target.value)}/>)}
 <Checkbox label={t('Pieza indivisible','Indivisible piece')} checked={g.unitIndivisible} onChange={e=>change(g.id,'unitIndivisible',e.target.checked)}/><Checkbox label={t('Apilable','Stackable')} checked={g.unitStackable} onChange={e=>change(g.id,'unitStackable',e.target.checked)}/>
 </div></fieldset>)}
 {errorFor('additionalUnits')?<p role="alert">{t('Completa cantidad, peso, volumen y dimensiones de todos los grupos.','Complete quantity, weight, volume and dimensions for every group.')}</p>:null}
 <div className={styles.computedTotals} aria-live="polite"><div><span>{t('Peso total','Total weight')}</span><strong>{draft.totalWeightKg||'—'} kg</strong></div><div><span>{t('Volumen total','Total volume')}</span><strong>{draft.totalVolumeM3||'—'} m³</strong></div></div></section>;
}
