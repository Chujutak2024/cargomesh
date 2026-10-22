'use client';
import {useRef,useState} from 'react';
import {Send,Sparkles} from 'lucide-react';
import {Button} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {NovaVoicePreview,type NovaTextSender} from '@/features/v2-conversation-prep/nova-voice-preview';
import s from './record-page.module.css';

export function CarrierNova({carrierId,opportunityId}:{carrierId:string;opportunityId:string}){
 const {t}=useLocale(),[open,setOpen]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[speaking,setSpeaking]=useState(false),[error,setError]=useState('');
 const [turns,setTurns]=useState<{id:string;role:string;text:string}[]>([]),sender=useRef<NovaTextSender|null>(null);
 async function send(){if(!text.trim()||busy||speaking||!sender.current)return;setBusy(true);setError('');try{await sender.current(text);setText('');}catch{setError(t('El canal escrito de Nova no está disponible. Puedes usar el micrófono.','Nova text is unavailable. You can use the microphone.'));}finally{setBusy(false);}}
 return <section className={s.assistant} aria-label="Nova Carrier"><button type="button" className={s.assistantToggle} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Sparkles size={18} aria-hidden="true"/>Nova<span>{open?t('Cerrar','Close'):t('Consultar','Ask')}</span></button>{open?<>
  <NovaVoicePreview carrierScope={{carrierId,opportunityId}} textInputRef={sender} onPlaybackStateChange={setSpeaking} onTurn={turn=>{if(turn.final)setTurns(rows=>[...rows.filter(row=>row.id!==turn.contentId),{id:turn.contentId,role:turn.role,text:turn.text}].slice(-6));}}/>
  {turns.length?<div className={s.transcript} aria-label={t('Conversación','Conversation')}>{turns.map(turn=><p key={turn.id}><strong>{turn.role==='user'?t('Tú','You'):'Nova'}:</strong> {turn.text}</p>)}</div>:null}
  <form className={s.message} onSubmit={event=>{event.preventDefault();void send();}}><label className={s.srOnly} htmlFor={`carrier-nova-${opportunityId}`}>{t('Pregunta a Nova','Ask Nova')}</label><input id={`carrier-nova-${opportunityId}`} value={text} maxLength={4096} onChange={event=>setText(event.target.value)} placeholder={t('Pregunta sobre esta solicitud…','Ask about this request…')}/><Button type="submit" aria-label={t('Enviar a Nova','Send to Nova')} disabled={busy||speaking||!text.trim()}><Send size={16}/></Button></form>
  {error?<p role="status">{error}</p>:null}
 </>:null}</section>;
}
