"use client";
import {useRef,useState} from "react";
import {QuoteSearchPanel} from "@/features/shipper-portal/quote-search-panel";
import {confirmChatQuoteAction,type QuoteRequestSnapshot} from "./chat-quote-action";

export function ChatQuotePanel({request,blocked,language,onChanged,onDiscuss}:{request:QuoteRequestSnapshot;blocked:boolean;language:"es"|"en";onChanged:()=>void;onDiscuss:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const keys=useRef(new Map<string,string>()),inFlight=useRef(false);
  return <div>
    {request.status!=="PENDING"&&<p role="status">{language==="es"?"Primero envía la solicitud desde Operaciones. Abrir esta búsqueda no envía el borrador ni autoriza una reserva.":"First submit the request in Operations. Opening this search does not submit a draft or authorize a booking."}</p>}
    <QuoteSearchPanel requestId={request.id} canSearch={!blocked&&request.status==="PENDING"} busy={busy||blocked} onNova={onDiscuss} onSearch={async deadline=>{
      if(blocked||inFlight.current)throw new Error("QUOTATION_BUSY");
      inFlight.current=true;setBusy(true);setError("");
      try {const result=await confirmChatQuoteAction(request,deadline,true,keys.current);onChanged();return result;}
      catch(e){const code=e instanceof Error?e.message:"QUOTE_UNAVAILABLE";setError(code==="STALE_DRAFT"?(language==="es"?"El pedido cambió. Recárgalo y revisa de nuevo antes de confirmar.":"The request changed. Reload and review before confirming again."):code);throw e;}
      finally{inFlight.current=false;setBusy(false);}
    }}/>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
