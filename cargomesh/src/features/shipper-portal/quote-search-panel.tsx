'use client';
import {useEffect,useState} from 'react';
import type {z} from 'zod';
import {Button,Input} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import type {QuoteHistorySchema,QuoteSearchResponseSchema} from '@/shared/schemas/v2/quote-automation';
import {readSimilarRequests} from './quote-api';
import s from './shipper-portal.module.css';
type Result=z.infer<typeof QuoteSearchResponseSchema>['data'];
export function QuoteSearchPanel({requestId,canSearch,busy,onSearch,onNova}:{requestId:string;canSearch:boolean;busy:boolean;onSearch:(deadline:string)=>Promise<Result>;onNova:()=>void}){
 const {t}=useLocale();const [deadline,setDeadline]=useState(''),[consent,setConsent]=useState(false),[result,setResult]=useState<Result|null>(null);
 const [history,setHistory]=useState<z.infer<typeof QuoteHistorySchema>|null>(null),[historyError,setHistoryError]=useState(false);
 useEffect(()=>{const controller=new AbortController();setHistory(null);setHistoryError(false);
  void readSimilarRequests(requestId,controller.signal).then(rows=>{if(!controller.signal.aborted)setHistory(rows);}).catch(()=>{if(!controller.signal.aborted)setHistoryError(true);});return()=>controller.abort();
 },[requestId]);
 async function search(){if(!consent||!deadline||busy)return;try{setResult(await onSearch(new Date(deadline).toISOString()));}catch{/* The parent reports native API errors. */}}
 return <section className={s.panel} aria-label={t('Cotización','Quotation')}>
  <header className={s.panelHeader}><h2>{t('Buscar ofertas de transporte','Find transport offers')}</h2></header>
  <p>{t('Se revisan cobertura, carga y disponibilidad. Verás hasta tres opciones para comparar.','Coverage, cargo and availability are checked. Compare up to three options.')}</p>
  <Button variant="secondary" disabled={busy} onClick={onNova}>{t('Consultar con Nova','Discuss with Nova')}</Button>
  {canSearch?<><Input type="datetime-local" label={t('Recibir respuestas hasta (hora local)','Response deadline (local time)')} value={deadline} onChange={e=>{setDeadline(e.target.value);setConsent(false);}} disabled={busy}/>
   <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> {t('Confirmo el pedido y autorizo solicitar ofertas.','I confirm the request and authorize requesting quotes.')}</label>
   <div className={s.heroActions}><Button disabled={busy||!consent||!deadline} isLoading={busy} onClick={()=>void search()}>{t('Buscar ofertas','Find offers')}</Button></div></>:null}
  {result?<p role="status">{t('Servicios revisados','Services reviewed')}: {result.evaluatedServices} · {t('Ofertas recibidas','Offers received')}: {result.outcomes.filter(o=>o.status==='OFFERED').length} · {t('Pendientes de Carrier','Awaiting carrier')}: {result.outcomes.filter(o=>o.status==='AWAITING_CARRIER').length} · {t('Requieren revisión','Require review')}: {result.unresolvedServices+result.outcomes.filter(o=>o.status==='REQUIRES_REVIEW').length}
   {result.rankingNotice?` · ${t('Ranking pendiente de política vigente.','Ranking awaits a current scoring policy.')}`:''}
   {result.outcomes.length===0?` · ${t('No hay servicios confirmados para estas condiciones. Revisa la factibilidad antes de continuar.','No confirmed services match these conditions. Review serviceability before continuing.')}`:''}</p>:null}
  <details><summary>{t('Casos similares de mi empresa','Similar cases from my company')}</summary>
   {historyError?<p role="status">{t('No se pudo consultar el historial. No hay una estimación disponible.','History could not be read. No estimate is available.')}</p>:history===null?<p>{t('Consultando historial…','Reading history…')}</p>:history.length===0?<p>{t('Todavía no hay casos similares; Nova no estimará un precio histórico.','No similar cases yet; Nova will not estimate a historical price.')}</p>:<ul>{history.map(row=><li key={row.requestId}>{row.reference} · {row.totalWeightKg} kg · {row.totalVolumeM3} m³{row.quotedPrices.length?` · ${t('Precios históricos','Historical prices')}: ${row.quotedPrices.map(p=>`USD ${p.amount.toFixed(2)}`).join(', ')}`:` · ${t('Sin precio registrado','No recorded price')}`}</li>)}</ul>}
   {history?.some(row=>row.quotedPrices.length)?<small>{t('Referencias históricas; se deben volver a validar precio y disponibilidad.','Historical references; price and availability must be revalidated.')}</small>:null}
  </details>
 </section>;
}
