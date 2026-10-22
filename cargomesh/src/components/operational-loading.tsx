import { LoaderCircle } from "lucide-react";
import styles from "./operational-state.module.css";
export function OperationalLoading() { return <div aria-busy="true" role="status" className={styles.loading}><LoaderCircle size={28} aria-hidden="true"/><span>Cargando / Loading</span></div>; }
