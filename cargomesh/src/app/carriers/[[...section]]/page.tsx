import { notFound } from 'next/navigation';
export default async function CarrierSection({ params }: { params: Promise<{ section?: string[] }> }) {
  const section = (await params).section ?? [];
  if (section.length && !['fleet', 'requests', 'offers', 'sites', 'orders', 'pipeline', 'help', 'control-tower', 'route-lab'].includes(section[0])) notFound();
  return null;
}
