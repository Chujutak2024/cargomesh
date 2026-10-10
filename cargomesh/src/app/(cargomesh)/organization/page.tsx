import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  const member = await requireOperationalRouteAccess();
  const db = await createV2ServerSupabaseClient();
  const { data, error } = await db.from("organizations").select("name,status").eq("id", member.organizationId).single();
  if (error || !data) throw new Error("ORGANIZATION_UNAVAILABLE");
  return <div className={styles.page}><header className={styles.header}><h1>Organización</h1></header>
    <section className={styles.panel}><h2>{data.name}</h2><p>Estado: {data.status}</p><p>Tu rol: {member.role}</p></section></div>;
}
