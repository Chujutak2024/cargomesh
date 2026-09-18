import { LoaderCircle } from "lucide-react";
export function OperationalLoading() { return <div aria-busy="true" role="status" style={{display:"grid",minHeight:"18rem",placeContent:"center",justifyItems:"center",gap:"0.65rem",color:"#52605e",fontSize:"0.75rem"}}><LoaderCircle size={28} aria-hidden="true"/><span>Cargando / Loading</span></div>; }
