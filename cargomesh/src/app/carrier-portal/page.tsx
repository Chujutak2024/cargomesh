import { redirect } from "next/navigation";

// Retire the duplicate entry. The workspace keeps its server-side access guard.
export default function Page() {
  redirect("/enter?portal=carrier");
}
