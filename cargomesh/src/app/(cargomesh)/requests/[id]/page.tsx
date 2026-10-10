import Link from "next/link";
import { notFound } from "next/navigation";
import { readWorkspaceRequest } from "@/server/services/v2-workspace/workspace-server";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { z } from "zod";
import styles from "../../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const request = await readWorkspaceRequest(id).catch(error => {
    if (error instanceof V2DraftError && error.httpStatus === 404) notFound();
    throw error;
  });
  return <div className={styles.page}><header className={styles.header}><div><h1>{request.referenceCode}</h1>
    <p>{request.origin.label} → {request.destination.label}</p></div></header>
    <section className={styles.panel}><h2>Solicitud V2 persistida</h2><dl>
      <dt>Estado</dt><dd>{request.status}</dd><dt>Versión</dt><dd>{request.draftVersion}</dd>
      <dt>Recojo (UTC)</dt><dd>{request.pickupWindow.startsAt} — {request.pickupWindow.endsAt}</dd>
      <dt>Servicio</dt><dd>{request.serviceType}</dd><dt>Modos aceptados</dt><dd>{request.acceptedModes.join(", ")}</dd>
    </dl><p>La solicitud no equivale a una oferta o reserva confirmada. La evaluación ROAD está disponible al crear la carga.</p>
    <Link href="/requests">Volver a mis cargas</Link></section></div>;
}
