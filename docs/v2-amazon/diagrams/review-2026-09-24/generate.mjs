// Source for editable review diagrams 02-05. Run: node generate.mjs
// Diagram 01 is generated separately by generate-domain-uml.mjs.
// This is a documentation generator, not a database or runtime contract.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const palettes = {
  domain: ['#f3f7fb', '#315679'],
  current: ['#e7f3ed', '#277451'],
  planned: ['#fff7e8', '#a96616'],
  external: ['#f2ebfa', '#7652a1'],
  note: ['#edf5fa', '#39718e'],
  neutral: ['#ffffff', '#4b5563'],
};
const node = (id, x, y, w, h, title, lines = [], kind = 'domain', extra = {}) => ({ id, x, y, w, h, title, lines, kind, ...extra });
const edge = (id, source, target, label = '', extra = {}) => ({ id, source, target, label, ...extra });
const graph = (name, title, subtitle, nodes, edges, opts = {}) => ({ name, title, subtitle, nodes, edges, width: opts.width ?? 1700, height: opts.height ?? 950, type: 'graph' });
const states = (name, title, subtitle, nodes, edges, opts = {}) => ({ ...graph(name, title, subtitle, nodes, edges, opts), type: 'states' });
const seq = (name, title, subtitle, actors, messages, opts = {}) => ({ name, title, subtitle, actors, messages, width: opts.width ?? 1760, height: opts.height ?? 980, type: 'sequence' });

const documents = [
  {
    file: '02-domain-classes.drawio',
    pages: [
      graph('Clases · solicitud', 'Clases de dominio · solicitud', 'Notación UML ligera: atributos y operaciones del dominio, no componentes React ni tablas SQL.', [
        node('org', 110, 220, 340, 280, 'Organization', ['+ id: UUID', '+ status: OrganizationStatus', '──────────────', '+ owns(memberId): boolean'], 'current', { shape: 'class' }),
        node('facility', 110, 610, 340, 225, 'Facility', ['+ id: UUID', '+ organizationId: UUID', '+ location: GeoLocation'], 'current', { shape: 'class' }),
        node('request', 650, 220, 385, 280, 'FreightRequest', ['+ id: UUID', '+ organizationId: UUID', '+ draftVersion: number', '+ status: RequestStatus', '──────────────', '+ submit(expectedVersion): Result'], 'current', { shape: 'class' }),
        node('cargo', 1210, 220, 360, 280, 'CargoSpecification', ['+ units: CargoUnit[]', '+ grossWeightKg: number', '+ volumeM3?: number', '+ requirements: CargoRequirement[]', '──────────────', '+ validate(): ConstraintResult'], 'planned', { shape: 'class' }),
        node('unit', 1210, 610, 360, 225, 'CargoUnit', ['+ quantity: number', '+ packageType: PackageType', '+ weightKg: number', '+ dimensions: Dimensions', '+ divisible: boolean'], 'planned', { shape: 'class' }),
      ], [
        edge('c1','org','facility','1     0..N'),
        edge('c2','org','request','1     0..N'),
        edge('c3','facility','request','origen/destino 0..1',{from:'right',to:'bottom'}),
        edge('c4','request','cargo','1     1'),
        edge('c5','cargo','unit','1     1..N'),
      ], { width: 1660, height: 920 }),
      graph('Clases · cobertura', 'Clases de dominio · cobertura y capacidad', 'Sede, cobertura y disponibilidad son conceptos distintos; la capacidad por fecha sigue propuesta.', [
        node('carrier', 70, 205, 310, 215, 'Carrier', ['+ id: UUID', '+ status: CarrierStatus', '+ name: string'], 'current', {shape:'class'}),
        node('depot', 70, 605, 310, 215, 'CarrierDepot', ['+ carrierId: UUID', '+ location: GeoLocation', '+ handling: Capability[]'], 'current', {shape:'class'}),
        node('service', 480, 205, 330, 245, 'CarrierService', ['+ carrierId: UUID', '+ mode: TransportMode', '+ serviceType: ServiceType', '+ status: ServiceStatus'], 'current', {shape:'class'}),
        node('area', 915, 205, 320, 245, 'ServiceArea', ['+ role: PICKUP | DELIVERY', '+ inclusion: INCLUDE | EXCLUDE', '+ geography: Geography', '+ validUntil?: Instant'], 'current', {shape:'class'}),
        node('lane', 1320, 205, 320, 245, 'ServiceLane', ['+ pickupAreaId: UUID', '+ deliveryAreaId: UUID', '+ direction: A_TO_B', '+ validUntil?: Instant'], 'current', {shape:'class'}),
        node('asset', 480, 605, 330, 245, 'TransportAsset', ['+ equipmentType: EquipmentType', '+ usefulCapacityKg: number', '+ homeDepotId?: UUID', '+ source: FulfilmentSource'], 'planned', {shape:'class'}),
        node('calendar', 915, 605, 320, 245, 'CapacityCalendar', ['+ reservations: Reservation[]', '+ maintenance: TimeWindow[]', '──────────────', '+ availableAt(window): Result'], 'planned', {shape:'class'}),
        node('pool', 1320, 605, 320, 245, 'CapacityPool', ['+ serviceId: UUID', '+ quantity: number', '+ source: FulfilmentSource', '+ validWindow: TimeWindow'], 'planned', {shape:'class'}),
      ], [
        edge('v1','carrier','service','1     0..N'),
        edge('v2','carrier','depot','1     0..N'),
        edge('v3','service','area','1     0..N'),
        edge('v4','area','lane',''),
        edge('v5','service','asset','0..N',{from:'bottom',to:'top'}),
        edge('v6','asset','calendar','agenda'),
        edge('v7','pool','calendar','agenda'),
      ], { width: 1700, height: 950 }),
      graph('Clases · ruta y recursos', 'Clases de dominio · ruta y recursos', 'Modo ≠ equipo. Un plan puede requerir varias unidades; escolta no suma capacidad portadora.', [
        node('node', 65, 205, 340, 225, 'LogisticsNode', ['+ id: UUID', '+ type: NodeType', '+ location: GeoLocation'], 'planned', {shape:'class'}),
        node('corridor', 490, 205, 340, 225, 'RouteCorridor', ['+ fromNodeId: UUID', '+ toNodeId: UUID', '+ mode: TransportMode', '+ source: DataSource'], 'planned', {shape:'class'}),
        node('leg', 915, 205, 340, 225, 'RouteLeg', ['+ corridorId: UUID', '+ distanceKm?: number', '+ eta?: Duration', '+ borderRequirements: Rule[]'], 'planned', {shape:'class'}),
        node('route', 1340, 205, 340, 225, 'RoutePlan', ['+ legs: RouteLeg[]', '+ source: DataSource', '+ routeStatus: EvidenceStatus'], 'planned', {shape:'class'}),
        node('equipment', 65, 595, 340, 225, 'EquipmentType', ['+ mode: TransportMode', '+ function: LOAD_BEARING | AUXILIARY', '+ physicalLimits: Limits'], 'planned', {shape:'class'}),
        node('asset', 490, 595, 340, 225, 'TransportAsset', ['+ equipmentType: EquipmentType', '+ usefulCapacityKg: number', '+ source: FulfilmentSource'], 'planned', {shape:'class'}),
        node('combination', 915, 595, 340, 225, 'VehicleCombination', ['+ members: TransportAsset[]', '+ carryingCapacityKg: number', '+ compatibility: Rule[]'], 'planned', {shape:'class'}),
        node('assignment', 1340, 595, 340, 225, 'PlanResource', ['+ role: LOAD_BEARING | AUXILIARY', '+ units: number', '+ window: TimeWindow', '+ availability: EvidenceStatus'], 'planned', {shape:'class'}),
      ], [
        edge('r1','node','corridor','extremos'),
        edge('r2','corridor','leg','1..N'),
        edge('r3','leg','route','1..N'),
        edge('r4','equipment','asset','tipo'),
        edge('r5','asset','combination','0..N'),
        edge('r6','combination','assignment','0..N'),
        edge('r7','route','assignment','por tramo'),
      ], { width: 1760, height: 920 }),
      graph('Clases · mercado', 'Clases de dominio · planes y mercado', 'Modelo objetivo sujeto a revisión: candidatura ≠ oferta; ranking ≠ autorización de booking.', [
        node('route', 65, 205, 325, 245, 'RoutePlan', ['+ legs: RouteLeg[]', '+ distanceKm?: number', '+ eta?: Duration', '+ source: DataSource'], 'planned', {shape:'class'}),
        node('plan', 490, 205, 350, 270, 'TransportPlanCandidate', ['+ requestId: UUID', '+ serviceIds: UUID[]', '+ route: RoutePlan', '+ resources: ResourceNeed[]', '+ window: TimeWindow'], 'planned', {shape:'class'}),
        node('opp', 940, 205, 330, 245, 'CarrierOpportunity', ['+ carrierId: UUID', '+ requestId: UUID', '+ planId: UUID', '+ responseDeadline: Instant'], 'planned', {shape:'class'}),
        node('offer', 1370, 205, 330, 270, 'CarrierOffer', ['+ issuerCarrierId: UUID', '+ price: Money', '+ validity: TimeWindow', '+ breakdown: CostLine[]', '+ source: OfferSource'], 'planned', {shape:'class'}),
        node('policy', 490, 625, 350, 225, 'ScoringPolicy', ['+ version: string', '+ weights: WeightSet', '+ missingDataRule: Rule', '──────────────', '+ rank(offers): RankedOffer[]'], 'planned', {shape:'class'}),
        node('booking', 1370, 625, 330, 225, 'Booking', ['+ offerId: UUID', '+ authorizedBy: MemberId', '+ carrierStatus: BookingStatus', '──────────────', '+ confirm(): Result'], 'planned', {shape:'class'}),
      ], [
        edge('m1','route','plan','1     0..N'),
        edge('m2','plan','opp','1     0..N'),
        edge('m3','opp','offer','1     0..N'),
        edge('m4','policy','offer','evalúa',{from:'right',to:'bottom'}),
        edge('m5','offer','booking','0..1 selección'),
      ], { width: 1760, height: 930 }),
    ],
  },
  {
    file: '03-state-machines.drawio',
    pages: [
      states('FreightRequest · verificado', 'Estado de FreightRequest · corte verificado', 'Solo DRAFT → PENDING está respaldado por el servicio V2. No se copian estados de orquestación WebMCP V1.', [
        node('start',125,420,36,36,'','', 'neutral',{shape:'initial'}),
        node('draft',330,370,230,135,'DRAFT',['edición con versión'],'current',{shape:'state'}),
        node('pending',790,370,230,135,'PENDING',['enviada por el shipper'],'current',{shape:'state'}),
        node('note',1150,335,390,220,'Fuera de esta máquina', ['409 STALE_DRAFT no cambia estado', 'Reintento idéntico = replay', 'Discovery es proceso separado', 'Transiciones posteriores: por decidir'], 'note'),
      ], [
        edge('s1','start','draft','crear borrador'),
        edge('s2','draft','pending','submit [tenant + versión válidos]'),
      ], {width:1620,height:830}),
      states('CarrierOpportunity · propuesta', 'Estado de CarrierOpportunity · propuesta', 'Invitación, respuesta o cierre. Eventos y nombres definitivos requieren aprobación del contrato.', [
        node('start',75,400,34,34,'','', 'neutral',{shape:'initial'}),
        node('invited',225,350,210,130,'INVITED',[],'planned',{shape:'state'}),
        node('await',570,350,250,130,'AWAITING_RESPONSE',[],'planned',{shape:'state'}),
        node('offered',1100,190,235,125,'OFFERED',['oferta atribuible'],'planned',{shape:'state'}),
        node('declined',1100,380,235,125,'DECLINED',[],'planned',{shape:'state'}),
        node('expired',1100,570,235,125,'EXPIRED',[],'planned',{shape:'state'}),
      ], [
        edge('o1','start','invited','publicar'),
        edge('o2','invited','await','entregar al carrier'),
        edge('o3','await','offered','carrier responde'),
        edge('o4','await','declined','carrier rechaza'),
        edge('o5','await','expired','vence plazo'),
      ], {width:1450,height:800}),
      states('CarrierOffer · propuesta', 'Estado de CarrierOffer · propuesta', 'La oferta nace del carrier. Su expiración/retiro no se convierte en oferta sintética de CargoMesh.', [
        node('start',75,405,34,34,'','', 'neutral',{shape:'initial'}),
        node('submitted',230,350,220,125,'SUBMITTED',[],'planned',{shape:'state'}),
        node('valid',610,350,220,125,'VALID',['fuente y vigencia'],'planned',{shape:'state'}),
        node('selected',1120,205,230,125,'SELECTED',['shipper autoriza'],'planned',{shape:'state'}),
        node('expired',1120,405,230,125,'EXPIRED',[],'planned',{shape:'state'}),
        node('withdrawn',1120,605,230,125,'WITHDRAWN',[],'planned',{shape:'state'}),
      ], [
        edge('f1','start','submitted','envío autenticado'),
        edge('f2','submitted','valid','validar términos'),
        edge('f3','valid','selected','selección humana'),
        edge('f4','valid','expired','vence vigencia'),
        edge('f5','valid','withdrawn','carrier retira'),
      ], {width:1470,height:810}),
      states('Booking · propuesta', 'Estado de Booking · propuesta', 'La autorización es guarda para crear el booking; la confirmación del carrier llega después.', [
        node('start',90,405,34,34,'','', 'neutral',{shape:'initial'}),
        node('requested',390,350,250,130,'REQUESTED',['a carrier'],'planned',{shape:'state'}),
        node('confirmed',1030,200,230,125,'CONFIRMED',[],'planned',{shape:'state'}),
        node('rejected',1030,400,230,125,'REJECTED',[],'planned',{shape:'state'}),
        node('expired',1030,600,230,125,'EXPIRED',[],'planned',{shape:'state'}),
      ], [
        edge('b1','start','requested','[shipper autoriza + oferta válida]'),
        edge('b3','requested','confirmed','carrier confirma'),
        edge('b4','requested','rejected','carrier rechaza'),
        edge('b5','requested','expired','timeout verificado'),
      ], {width:1380,height:810}),
    ],
  },
  {
    file: '04-sequences.drawio',
    pages: [
      seq('Consulta Web o Alexa', 'Secuencia · intake y discovery', 'Canales alternativos, un servicio de aplicación. Sugerencia provisional no es cotización.', [
        'Shipper', 'Web / Alexa+', 'Hono / MCP', 'Servicio V2', 'Supabase', 'Geo / ruteo', 'Carrier adapter'
      ], [
        ['Shipper','Web / Alexa+','1  Ingresa carga, origen y fecha'],
        ['Web / Alexa+','Hono / MCP','2  Crear/actualizar draft'],
        ['Hono / MCP','Servicio V2','3  Autenticar tenant + validar versión'],
        ['Servicio V2','Supabase','4  Persistir DRAFT idempotente'],
        ['Web / Alexa+','Hono / MCP','5  Pedir opciones preliminares'],
        ['Hono / MCP','Servicio V2','6  Evaluar servicio y ventana'],
        ['Servicio V2','Geo / ruteo','7  Resolver ruta con fuente'],
        ['Servicio V2','Supabase','8  Leer áreas, lanes y capacidad'],
        ['Servicio V2','Carrier adapter','9  Consultar solo integración disponible'],
        ['Servicio V2','Hono / MCP','10  Planes + razones + unknown'],
        ['Hono / MCP','Web / Alexa+','11  Resultado compartido, sin precio inventado'],
      ], {height:1030}),
      seq('Oferta y booking', 'Secuencia · oferta, ranking y booking', 'Solo ofertas del carrier válidas entran al ranking; autorización del shipper antes de reservar.', [
        'Shipper', 'Web / Alexa+', 'Hono / MCP', 'Servicio V2', 'Supabase', 'Carrier'
      ], [
        ['Servicio V2','Carrier','1  Enviar oportunidad elegible'],
        ['Carrier','Servicio V2','2  Responder oferta o rechazar'],
        ['Servicio V2','Supabase','3  Guardar fuente, vigencia y desglose'],
        ['Servicio V2','Supabase','4  Leer ScoringPolicy versionada'],
        ['Servicio V2','Web / Alexa+','5  Ofertas comparables + explicación'],
        ['Shipper','Web / Alexa+','6  Elegir y confirmar'],
        ['Web / Alexa+','Hono / MCP','7  Autorizar selección'],
        ['Hono / MCP','Servicio V2','8  Revalidar oferta, tenant y capacidad'],
        ['Servicio V2','Carrier','9  Solicitar booking idempotente'],
        ['Carrier','Servicio V2','10  Confirmar, rechazar o pending'],
        ['Servicio V2','Supabase','11  Auditar resultado y fuente'],
        ['Servicio V2','Web / Alexa+','12  Mostrar estado real del carrier'],
      ], {height:1070}),
    ],
  },
  {
    file: '05-container-architecture.drawio',
    pages: [graph('Contenedores V2', 'Arquitectura · contenedores CargoMesh V2', 'Vista C4 ligera: canales, adaptadores, núcleo compartido y sistemas externos. No implica que cada integración esté live.', [
      node('web', 70, 230,280,125,'Web React / Next',['stepper y resultados'],'current'),
      node('alexa',70,560,280,125,'Alexa+',['cliente conversacional'],'external'),
      node('hono',475,230,285,125,'Hono API',['auth + validación'],'current'),
      node('mcp',475,560,285,125,'MCP adapter',['auth + tools + SSML'],'current'),
      node('application',890,390,320,155,'Servicios de aplicación',['intake · discovery · ofertas', 'selección · booking'],'planned'),
      node('domain',890,665,320,125,'Dominio V2',['restricciones + scoring'],'planned'),
      node('db',1330,180,290,125,'Supabase / PostgreSQL',['RLS + auditoría'],'current'),
      node('maps',1330,425,290,125,'Mapas / geodatos',['adaptador con procedencia'],'external'),
      node('carrier',1330,685,290,125,'Carriers externos',['portal · API · MCP si existen'],'external'),
    ], [
      edge('a1','web','hono','HTTP'),
      edge('a2','alexa','mcp','MCP'),
      edge('a3','hono','application',''),
      edge('a4','mcp','application',''),
      edge('a5','application','domain','reglas compartidas'),
      edge('a6','application','db','persistencia'),
      edge('a7','application','maps','consulta'),
      edge('a8','application','carrier','adaptadores'),
    ], {width:1700,height:900})],
  },
];

const htmlValue = (n) => {
  if (n.shape === 'initial') return '';
  if (n.shape === 'state') return '<b>' + esc(n.title) + '</b>' + (n.lines.length ? '<br>' + n.lines.map(esc).join('<br>') : '');
  if (n.shape === 'class') return '<b>' + esc(n.title) + '</b><br>──────────────────<br>' + n.lines.map(esc).join('<br>');
  return '<b>' + esc(n.title) + '</b>' + (n.lines.length ? '<br>' + n.lines.map(esc).join('<br>') : '');
};
function nodeXml(n) {
  const [fill, stroke] = palettes[n.kind] ?? palettes.domain;
  const ellipse = n.shape === 'state' || n.shape === 'initial';
  const style = [
    ellipse ? 'ellipse' : 'rounded=0',
    'whiteSpace=wrap','html=1',
    'fillColor=' + (n.shape === 'initial' ? '#1f2937' : fill),
    'strokeColor=' + (n.shape === 'initial' ? '#1f2937' : stroke),
    'fontColor=#1f2937',
    'fontFamily=Arial',
    'fontSize=' + (n.shape === 'class' ? '16' : '17'),
    'strokeWidth=2',
    'align=center',
    'verticalAlign=middle',
    'spacing=12',
    n.kind === 'planned' ? 'dashed=1' : '',
  ].filter(Boolean).join(';') + ';';
  return `<mxCell id="${esc(n.id)}" value="${esc(htmlValue(n))}" style="${style}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`;
}
function edgeXml(e, nodes) {
  const a = nodes.find(n => n.id === e.source), b = nodes.find(n => n.id === e.target);
  if (!a || !b) throw Error('Bad edge: ' + e.id);
  const dx = (b.x+b.w/2) - (a.x+a.w/2);
  const dy = (b.y+b.h/2) - (a.y+a.h/2);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const from = e.from ?? (horizontal ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top'));
  const to = e.to ?? (horizontal ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom'));
  const anchors = { right:[1,.5], left:[0,.5], top:[.5,0], bottom:[.5,1] };
  const [x1,y1]=anchors[from], [x2,y2]=anchors[to];
  const style = [
    'edgeStyle=orthogonalEdgeStyle','rounded=0','html=1','endArrow=block','endFill=1',
    'strokeColor=#64748b','strokeWidth=2','fontColor=#334155','fontSize=13',
    'labelBackgroundColor=#ffffff',
    `exitX=${x1}`,`exitY=${y1}`,'exitDx=0','exitDy=0',
    `entryX=${x2}`,`entryY=${y2}`,'entryDx=0','entryDy=0',
    e.dashed ? 'dashed=1' : '',
  ].filter(Boolean).join(';') + ';';
  return `<mxCell id="${esc(e.id)}" value="${esc(e.label)}" style="${style}" edge="1" parent="1" source="${esc(e.source)}" target="${esc(e.target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
}
function graphPage(p, index) {
  const header = `<mxCell id="title" value="&lt;b&gt;${esc(p.title)}&lt;/b&gt;&lt;br&gt;${esc(p.subtitle)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#1f2937;fontFamily=Arial;fontSize=19;align=left;verticalAlign=middle;spacing=8;" vertex="1" parent="1"><mxGeometry x="50" y="35" width="${p.width-100}" height="100" as="geometry"/></mxCell>`;
  const baseline = `<mxCell id="rule" value="" style="line;strokeColor=#cbd5e1;strokeWidth=1;" vertex="1" parent="1"><mxGeometry x="50" y="145" width="${p.width-100}" height="1" as="geometry"/></mxCell>`;
  const status = p.type === 'states' ? 'Verde: verificado · ámbar discontinuo: propuesto' : 'Verde: existente · ámbar discontinuo: objetivo · violeta: externo';
  const footer = `<mxCell id="footer" value="${esc(status)}   |   Revisión del 24 sep 2026 · no autoriza migraciones ni declara integraciones live" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#64748b;fontFamily=Arial;fontSize=13;align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="50" y="${p.height-45}" width="${p.width-100}" height="30" as="geometry"/></mxCell>`;
  const cells = [header,baseline,...p.nodes.map(nodeXml),...p.edges.map(e=>edgeXml(e,p.nodes)),footer].join('\n        ');
  return `<diagram id="page-${index}" name="${esc(p.name)}"><mxGraphModel grid="0" guides="1" page="1" pageWidth="${p.width}" pageHeight="${p.height}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram>`;
}
function seqPage(p, index) {
  const header = `<mxCell id="title" value="&lt;b&gt;${esc(p.title)}&lt;/b&gt;&lt;br&gt;${esc(p.subtitle)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#1f2937;fontFamily=Arial;fontSize=19;align=left;verticalAlign=middle;spacing=8;" vertex="1" parent="1"><mxGeometry x="45" y="25" width="${p.width-90}" height="95" as="geometry"/></mxCell>`;
  const left = 40, usable = p.width-80, step = usable/p.actors.length, headerY=155, lineBottom=p.height-75;
  const actors = p.actors.map((a,i) => {
    const x=Math.round(left+i*step+step*.08), w=Math.round(step*.84), cx=x+w/2;
    return { id:'actor'+i, name:a, x, w, cx };
  });
  const cells = [header];
  for (const a of actors) {
    cells.push(`<mxCell id="${a.id}" value="&lt;b&gt;${esc(a.name)}&lt;/b&gt;" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#f3f7fb;strokeColor=#315679;strokeWidth=2;fontColor=#1f2937;fontFamily=Arial;fontSize=16;align=center;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${a.x}" y="${headerY}" width="${a.w}" height="66" as="geometry"/></mxCell>`);
    cells.push(`<mxCell id="life-${a.id}" value="" style="line;dashed=1;strokeColor=#94a3b8;strokeWidth=2;" vertex="1" parent="1"><mxGeometry x="${Math.round(a.cx)}" y="${headerY+66}" width="1" height="${lineBottom-headerY-66}" as="geometry"/></mxCell>`);
  }
  const y0=280, gap=Math.min(60,Math.floor((lineBottom-y0)/p.messages.length));
  p.messages.forEach(([from,to,label],i) => {
    const a=actors.find(x=>x.name===from), b=actors.find(x=>x.name===to), y=y0+i*gap;
    if(!a||!b) throw Error('Bad sequence actor: '+label);
    const x1=Math.round(a.cx),x2=Math.round(b.cx);
    const sx=Math.min(x1,x2), sw=Math.abs(x2-x1);
    cells.push(`<mxCell id="msg-${i}" value="" style="line;strokeColor=#475569;strokeWidth=2;endArrow=block;endFill=1;flipH=${x1>x2?1:0};" vertex="1" parent="1"><mxGeometry x="${sx}" y="${y}" width="${sw}" height="1" as="geometry"/></mxCell>`);
    cells.push(`<mxCell id="label-${i}" value="${esc(label)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#1f2937;fontFamily=Arial;fontSize=13;align=center;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${sx+4}" y="${y-37}" width="${Math.max(100,sw-8)}" height="31" as="geometry"/></mxCell>`);
  });
  cells.push(`<mxCell id="footer" value="Secuencia objetivo V2 · el diagrama no declara tool ni carrier live" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#64748b;fontFamily=Arial;fontSize=13;align=left;" vertex="1" parent="1"><mxGeometry x="45" y="${p.height-44}" width="${p.width-90}" height="25" as="geometry"/></mxCell>`);
  return `<diagram id="page-${index}" name="${esc(p.name)}"><mxGraphModel grid="0" guides="1" page="1" pageWidth="${p.width}" pageHeight="${p.height}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n        ')}</root></mxGraphModel></diagram>`;
}
for (const doc of documents) {
  const pages=doc.pages.map((p,i)=>p.type==='sequence'?seqPage(p,i):graphPage(p,i));
  const xml=`<mxfile host="app.diagrams.net" agent="CargoMesh V2" type="device" pages="${pages.length}">\n  ${pages.join('\n  ')}\n</mxfile>\n`;
  writeFileSync(join(out,doc.file),xml,'utf8');
}
// SVGs are visual review exports from the same geometry. The .drawio files remain editable sources.
function svgPage(p) {
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}">`,
    '<defs><marker id="arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0,9 3.5,0 7" fill="#64748b"/></marker></defs>',
    `<rect width="${p.width}" height="${p.height}" fill="#ffffff"/>`,
    `<text x="50" y="68" font-family="Arial" font-size="27" font-weight="bold" fill="#1f2937">${esc(p.title)}</text>`,
    `<text x="50" y="108" font-family="Arial" font-size="17" fill="#475569">${esc(p.subtitle)}</text>`,
    `<line x1="50" y1="145" x2="${p.width-50}" y2="145" stroke="#cbd5e1"/>`];
  if(p.type==='sequence') {
    const left=40, step=(p.width-80)/p.actors.length, headerY=155, bottom=p.height-75;
    const actors=p.actors.map((name,i)=>({name,cx:Math.round(left+i*step+step/2),x:Math.round(left+i*step+step*.08),w:Math.round(step*.84)}));
    for(const a of actors){
      parts.push(`<rect x="${a.x}" y="${headerY}" width="${a.w}" height="66" fill="#f3f7fb" stroke="#315679" stroke-width="2"/><text x="${a.cx}" y="${headerY+39}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#1f2937">${esc(a.name)}</text><line x1="${a.cx}" y1="${headerY+66}" x2="${a.cx}" y2="${bottom}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8 6"/>`);
    }
    const y0=280, gap=Math.min(60,Math.floor((bottom-y0)/p.messages.length));
    p.messages.forEach(([from,to,label],i)=>{
      const a=actors.find(x=>x.name===from),b=actors.find(x=>x.name===to),y=y0+i*gap;
      const x1=a.cx,x2=b.cx,m=(x1+x2)/2;
      parts.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/><rect x="${Math.min(x1,x2)+4}" y="${y-34}" width="${Math.abs(x2-x1)-8}" height="28" fill="#ffffff"/><text x="${m}" y="${y-14}" text-anchor="middle" font-family="Arial" font-size="13" fill="#1f2937">${esc(label)}</text>`);
    });
  } else {
    for(const e of p.edges){
      const a=p.nodes.find(n=>n.id===e.source),b=p.nodes.find(n=>n.id===e.target);
      const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;
      const horiz=Math.abs(bx-ax)>=Math.abs(by-ay);
      const x1=horiz?(bx>=ax?a.x+a.w:a.x):(a.x+a.w/2), y1=horiz?ay:(by>=ay?a.y+a.h:a.y);
      const x2=horiz?(bx>=ax?b.x:b.x+b.w):(b.x+b.w/2), y2=horiz?by:(by>=ay?b.y:b.y+b.h);
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>`);
      if(e.label){
        const mx=(x1+x2)/2,my=(y1+y2)/2;
        parts.push(`<rect x="${mx-85}" y="${my-17}" width="170" height="23" fill="#ffffff"/><text x="${mx}" y="${my}" text-anchor="middle" font-family="Arial" font-size="13" fill="#334155">${esc(e.label)}</text>`);
      }
    }
    for(const n of p.nodes){
      const [fill,stroke]=palettes[n.kind]??palettes.domain;
      if(n.shape==='initial'){parts.push(`<circle cx="${n.x+n.w/2}" cy="${n.y+n.h/2}" r="${n.w/2}" fill="#1f2937"/>`);continue;}
      if(n.shape==='state'){
        parts.push(`<ellipse cx="${n.x+n.w/2}" cy="${n.y+n.h/2}" rx="${n.w/2}" ry="${n.h/2}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${n.kind==='planned'?'stroke-dasharray="8 5"':''}/>`);
      } else {
        parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${n.kind==='planned'?'stroke-dasharray="8 5"':''}/>`);
        if(n.shape==='class') parts.push(`<line x1="${n.x}" y1="${n.y+50}" x2="${n.x+n.w}" y2="${n.y+50}" stroke="${stroke}"/>`);
      }
      parts.push(`<text x="${n.x+n.w/2}" y="${n.y+34}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#1f2937">${esc(n.title)}</text>`);
      n.lines.filter(l=>!l.startsWith('──')).forEach((line,i)=>{
        const y=n.y+(n.shape==='class'?82:62)+i*25;
        parts.push(`<text x="${n.x+n.w/2}" y="${y}" text-anchor="middle" font-family="Arial" font-size="15" fill="#334155">${esc(line)}</text>`);
      });
    }
  }
  parts.push(`<text x="50" y="${p.height-24}" font-family="Arial" font-size="13" fill="#64748b">Revisión 24 sep 2026 · borrador de diseño, no prueba de implementación</text></svg>`);
  return parts.join('');
}
for(const doc of documents) doc.pages.forEach((p,i)=>{
  const base=doc.file.replace('.drawio','');
  writeFileSync(join(out,`${base}-p${i+1}.svg`),svgPage(p),'utf8');
});
console.log(documents.map(d=>d.file+' ('+d.pages.length+' pages)').join('\n'));
