export default function LoadingWorkspace() {
 return <main aria-busy="true" style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#e5edf6",color:"#163349",fontFamily:"Arial, sans-serif"}}>
  <section role="status" aria-live="polite" style={{padding:32,maxWidth:440}}>
   <strong style={{fontSize:20}}>Opening Carrier workspace…</strong>
   <p>Checking your session and secure access.</p>
  </section>
 </main>;
}
