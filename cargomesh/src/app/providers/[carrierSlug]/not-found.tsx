import Link from "next/link";

import styles from "./provider.module.css";

export default function ProviderNotFound() {
  return (
    <main className={styles.notFound}>
      <p className={styles.eyebrow}>Provider Registry</p>
      <h1>Transportista no disponible</h1>
      <p>
        El slug no corresponde a un carrier activo con WebMCP y al menos un servicio
        habilitado.
      </p>
      <Link href="/">Volver a CargoMesh</Link>
    </main>
  );
}
