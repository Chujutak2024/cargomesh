// Enriches the user's manually arranged UML while preserving its four-page layout.
// Run: node docs/v2-amazon/diagrams/review-2026-09-24/generate-domain-uml.mjs
// Documentation only: this does not apply Supabase migrations or assert V2 is live.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const source = join(dir, '01-domain-user-layout-source.drawio.xml');
const target = join(dir, '01-domain-conceptual.drawio');
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Only business attributes appear in the drawing. SQL IDs/FKs, created_at and
// WebMCP/V1-only switches are intentionally absent from this conceptual model.
const additions = [
  {
    height: 900,
    cells: {
      org: ['Organización', ['nombreComercial', 'razónSocial', 'identificaciónFiscal', 'paísDeRegistro', 'monedaBase', 'segmentoCliente', 'estado']],
      req: ['SolicitudDeFlete', ['código', 'origen', 'destino', 'ventanaDeRecojo', 'límiteDeEntrega', 'tipoDeServicio', 'modosAceptados', 'equipoRequeridoOPreferido', 'presupuestoMáximo', 'objetivoDeSelección', 'estado', 'versiónDelBorrador']],
      spec: ['EspecificaciónDeCarga', ['categoría', 'descripción', 'pesoTotalKg', 'volumenTotalM3', 'embalaje', 'divisibilidad', 'temperaturaMinMax', 'restriccionesDeManipulación', 'documentosDisponibles', 'instruccionesEspeciales']],
      facility: ['SedeDelCliente', ['código', 'nombre', 'tipoDeSede', 'ubicación', 'códigoPostal', 'coordenadas', 'instruccionesDeAcceso', 'activa']],
      unit: ['UnidadDeCarga', ['tipoDeUnidad', 'cantidad', 'pesoPorUnidadKg', 'volumenPorUnidadM3', 'dimensiones', 'unidadesPorBulto', 'apilable', 'indivisible']],
    },
  },
  {
    height: 1040,
    cells: {
      carrier: ['Carrier', ['nombreComercial', 'tipoDeOperador', 'paísDeRegistro', 'canalDeRespuesta', 'contactoOperativo', 'identificadorComercial', 'estado']],
      service: ['ServicioDelCarrier', ['modo', 'claseDeServicio', 'cargasAdmitidas', 'capacidadMáximaKg', 'volumenMáximoM3', 'rangoDeTemperatura', 'manejoEspecial', 'cruceFronterizo', 'coordinaciónAduanera', 'estadoYVigencia']],
      area: ['ÁreaDeServicio', ['rolRecojoOEntrega', 'inclusiónOExclusión', 'granularidad', 'paísRegiónCiudadOCódigoPostal', 'fuentePropiaOSocio', 'referenciaSocio', 'evidencia', 'verificadaEn', 'vigencia', 'activa']],
      depot: ['SedeDelCarrier', ['código', 'nombre', 'ubicación', 'códigoPostal', 'coordenadas', 'activa']],
      asset: ['ActivoDeTransporte', ['códigoDeUnidad', 'tipoDeEquipo', 'configuración', 'capacidadÚtilKg', 'volumenÚtilM3', 'pesoBrutoMáximoKg', 'dimensionesÚtiles', 'capacidadEspecial', 'baseOperativa', 'estadoYFuente']],
      lane: ['LaneDeServicio', ['áreaDeRecojo', 'áreaDeEntrega', 'tipoDirectoOLocal', 'modoROAD', 'requiereRevisiónFronteriza', 'evidencia', 'verificadaEn', 'vigencia', 'activa']],
      pool: ['CupoContratado', ['modo', 'tramo', 'capacidadDeclarada', 'unidadDeCapacidad', 'ventana', 'socioResponsable', 'evidencia', 'vigencia']],
    },
  },
  {
    height: 980,
    cells: {
      request: ['SolicitudDeFlete', ['origen', 'destino', 'ventanaDeRecojo', 'cargaNormalizada', 'presupuestoMáximo'], 'referencia página 1'],
      plan: ['PlanCandidato', ['ventanaPropuesta', 'serviciosPorTramo', 'ruta', 'recursosNecesarios', 'estadoDeCobertura', 'estadoDeDisponibilidad', 'requisitosPendientes', 'costoEstimado', 'motivosDeExclusión']],
      route: ['RutaPropuesta', ['origen', 'destino', 'distanciaEstimadaKm', 'duraciónEstimada', 'peajesEstimados', 'costosDeFrontera', 'fuenteGeográfica', 'confianzaYVigencia']],
      leg: ['TramoDeRuta', ['orden', 'origen', 'destino', 'modo', 'distanciaKm', 'duraciónEstimada', 'servicioResponsable', 'requisitosDeFrontera']],
      service: ['ServicioDelCarrier', ['modo', 'claseDeServicio', 'capacidadMáxima', 'requisitosDeCarga', 'vigencia'], 'referencia página 2'],
      assignment: ['RecursoDelPlan', ['funciónPortadoraOAuxiliar', 'tipoDeEquipo', 'cantidad', 'ventana', 'activoOCupo', 'capacidadAplicable', 'disponibilidad', 'fuenteDeVerificación']],
      asset: ['ActivoDeTransporte', ['tipoDeEquipo', 'capacidadÚtilKg', 'volumenÚtilM3', 'estadoOperativo'], 'referencia página 2'],
      pool: ['CupoContratado', ['capacidadDeclarada', 'ventana', 'socioResponsable', 'fuente'], 'referencia página 2'],
    },
  },
  {
    height: 1010,
    cells: {
      plan: ['PlanCandidato', ['ventanaPropuesta', 'elegibilidad', 'requisitosPendientes', 'costoEstimado'], 'referencia página 3'],
      opp: ['OportunidadDelCarrier', ['carrierInvitado', 'planPropuesto', 'fechaDeInvitación', 'plazoDeRespuesta', 'canalDeRespuesta', 'estado', 'trazabilidad']],
      offer: ['OfertaDelCarrier', ['referenciaDelCarrier', 'precio', 'moneda', 'desgloseDeCosto', 'recargos', 'descuentoAutorizado', 'ETA', 'capacidadReservable', 'vigencia', 'condiciones', 'fuenteYEstado']],
      booking: ['ReservaDeTransporte', ['ofertaAceptada', 'autorizadoPor', 'autorizadoEn', 'estadoDeSolicitud', 'estadoDelCarrier', 'referenciaDelCarrier', 'confirmadoEn']],
      carrier: ['Carrier', ['nombreComercial', 'tipoDeOperador', 'canalDeRespuesta', 'estado'], 'referencia página 2'],
      policy: ['PolíticaDeRanking', ['versión', 'objetivo', 'dimensiones', 'ponderaciones', 'normalización', 'reglaDeFaltantes', 'desempate']],
      ranked: ['OpciónComparada', ['posición', 'puntaje', 'desglose', 'explicación', 'datosFaltantes', 'versiónDePolítica', 'ofertaEvaluada'], 'resultado derivado'],
    },
  },
];

function updateCell(page, id, [name, attributes, note = '']) {
  const cellPattern = new RegExp(`<mxCell\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/mxCell>`);
  if (!cellPattern.test(page)) throw new Error(`Missing ${id} in source layout`);
  return page.replace(cellPattern, cell => {
    const lines = attributes.map(escapeXml).join('&lt;br&gt;');
    const value = `&lt;b&gt;${escapeXml(name)}&lt;/b&gt;${note ? `&lt;br&gt;&lt;i&gt;${escapeXml(note)}&lt;/i&gt;` : ''}&lt;hr&gt;${lines}`;
    const minHeight = 46 + attributes.length * 20 + (note ? 20 : 0);
    const oldHeight = Number(cell.match(/<mxGeometry\b[^>]*\bheight="([\d.]+)"/)?.[1]);
    if (!Number.isFinite(oldHeight)) throw new Error(`Missing geometry on ${id}`);
    return cell
      .replace(/\bvalue="[^"]*"/, `value="${value}"`)
      .replace(/fontSize=16/, 'fontSize=14')
      .replace(/spacingLeft=13/, 'spacingLeft=10')
      .replace(/spacingTop=10/, 'spacingTop=7')
      .replace(/(<mxGeometry\b[^>]*\bheight=")[\d.]+(")/, `$1${Math.max(oldHeight, minHeight)}$2`);
  });
}
function updatePage(page, config) {
  for (const [id, data] of Object.entries(config.cells)) page = updateCell(page, id, data);
  page = page.replace(/\bpageHeight="[\d.]+"/, `pageHeight="${config.height}"`);
  page = page.replace(/<mxCell\b[^>]*\bid="footer"[^>]*>[\s\S]*?<\/mxCell>/, cell =>
    cell.replace(/(<mxGeometry\b[^>]*\by=")[\d.]+(")/, `$1${config.height - 55}$2`));
  return page;
}

const classCell = (id, name, attrs, x, y, note = '') => {
  const h = 46 + attrs.length * 20 + (note ? 20 : 0);
  const value = `&lt;b&gt;${escapeXml(name)}&lt;/b&gt;${note ? `&lt;br&gt;&lt;i&gt;${escapeXml(note)}&lt;/i&gt;` : ''}&lt;hr&gt;${attrs.map(escapeXml).join('&lt;br&gt;')}`;
  return `<mxCell id="${id}" parent="1" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=7;fillColor=#f7faff;strokeColor=#315679;strokeWidth=2;fontFamily=Arial;fontSize=14;fontColor=#182c3e;" value="${value}" vertex="1"><mxGeometry height="${h}" width="330" x="${x}" y="${y}" as="geometry"/></mxCell>`;
};
const association = (id, from, to, label, fromMultiplicity, toMultiplicity, extraStyle = '') => {
  const edge = `<mxCell id="${id}" parent="1" source="${from}" target="${to}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;startArrow=none;strokeColor=#52667a;strokeWidth=2;fontFamily=Arial;fontSize=14;fontColor=#24394c;labelBackgroundColor=#ffffff;${extraStyle}" value="${escapeXml(label)}" edge="1"><mxGeometry relative="1" as="geometry"/></mxCell>`;
  const end = (side, value, x) => `<mxCell id="${id}-${side}" parent="${id}" value="${escapeXml(value)}" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];fontSize=15;fontStyle=1;fontColor=#182c3e;labelBackgroundColor=#ffffff;" vertex="1" connectable="0"><mxGeometry x="${x}" y="-15" relative="1" as="geometry"><mxPoint x="0" y="0" as="offset"/></mxGeometry></mxCell>`;
  return edge + end('from', fromMultiplicity, -0.83) + end('to', toMultiplicity, 0.83);
};
function contextPage() {
  const cells = [
    `<mxCell id="title" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#182c3e;fontFamily=Arial;fontSize=20;align=left;verticalAlign=middle;" value="&lt;b&gt;Modelo de dominio UML · preferencias, perfiles y métricas&lt;/b&gt;&lt;br&gt;Conceptos reutilizables; los datos V1 existentes no prueban que este flujo V2 esté operativo." vertex="1"><mxGeometry height="100" width="1660" x="50" y="35" as="geometry"/></mxCell>`,
    classCell('org', 'Organización', ['nombreComercial', 'segmentoCliente', 'monedaBase'], 65, 195, 'referencia página 1'),
    classCell('pref', 'PreferenciasDelCliente', ['objetivoDeSelección', 'esperaMáxima', 'presupuestoHabitual', 'modoPreferido', 'equipoPreferido', 'carrierPreferido', 'vigencia'], 490, 195),
    classCell('profile', 'PerfilDeCarga', ['nombre', 'categoría', 'métodoDeEntrada', 'cantidadHabitual', 'pesoPorUnidad', 'dimensiones', 'requisitos', 'equipoPreferido'], 65, 555),
    classCell('category', 'CategoríaDeCarga', ['nombre', 'descripción', 'requisitosSugeridos', 'equipoSugerido', 'métodoDeEntradaSugerido'], 490, 555),
    classCell('carrier', 'Carrier', ['nombreComercial', 'tipoDeOperador', 'estado'], 920, 195, 'referencia página 2'),
    classCell('metric', 'MétricaOperativa', ['período', 'corredor', 'modo', 'categoría', 'envíosCompletados', 'envíosExitosos', 'retrasoMedioHoras', 'tamañoDeMuestra', 'fuente'], 1335, 195),
    association('x1', 'org', 'pref', 'define', '1', '0..1'),
    association('x2', 'org', 'profile', 'guarda', '1', '0..*'),
    association('x3', 'profile', 'category', 'clasifica', '0..*', '1'),
    association('x4', 'carrier', 'metric', 'tiene historial', '1', '0..*'),
    `<mxCell id="footer" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontColor=#52667a;fontFamily=Arial;fontSize=14;align=left;" value="Preferencias e históricos sugieren; no heredan precio, capacidad, permisos ni autorización de booking" vertex="1"><mxGeometry height="30" width="1660" x="50" y="845" as="geometry"/></mxCell>`,
  ];
  return `<diagram id="domain-uml-5" name="5 · Preferencias e historial"><mxGraphModel grid="0" guides="1" page="1" pageWidth="1760" pageHeight="900" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n')}</root></mxGraphModel></diagram>`;
}

let drawing = readFileSync(source, 'utf8');
const pages = drawing.match(/<diagram\b[\s\S]*?<\/diagram>/g);
if (pages?.length !== 4) throw new Error('Expected four source pages');
for (let i = 0; i < pages.length; i++) drawing = drawing.replace(pages[i], updatePage(pages[i], additions[i]));
// HAC-21 persists two independent nullable roles, each constrained to the
// request's organization. A single 0..2 edge obscured which site is origin.
drawing = drawing.replace(/<mxCell\b[^>]*\bid="s5"[^>]*>[\s\S]*?<\/mxCell>\s*<mxCell\b[^>]*\bid="s5-from"[^>]*>[\s\S]*?<\/mxCell>\s*<mxCell\b[^>]*\bid="s5-to"[^>]*>[\s\S]*?<\/mxCell>/, () =>
  association('s5-origin', 'facility', 'req', 'origen', '0..1', '0..*', 'exitX=1;exitY=0.2;entryX=0;entryY=0.75;') +
  association('s5-destination', 'facility', 'req', 'destino', '0..1', '0..*', 'exitX=1;exitY=0.7;entryX=0;entryY=0.95;'));
// The shared layout contains one accidental duplicate edge, and c6 was
// reattached from Servicio to Área while rearranging boxes. Coverage is
// declared by Área/Lane; a contracted capacity pool belongs to the service.
drawing = drawing.replace(/<mxCell id="pzvAjzquH-_w40mvFe9D-1"[\s\S]*?<\/mxCell>\s*/, '');
drawing = drawing.replace(/(<mxCell id="c6"[^>]*\bsource=")area("[^>]*>)/, '$1service$2');
drawing = drawing.replace(/(<mxCell id="c6"[\s\S]*?<\/mxCell>)/, `$1
<mxCell id="c6-from" connectable="0" parent="c6" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];fontSize=15;fontStyle=1;fontColor=#182c3e;labelBackgroundColor=#ffffff;" value="1" vertex="1"><mxGeometry relative="1" x="-0.83" y="-15" as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>`);
drawing = drawing.replace(/\bpages="4"/, 'pages="5"');
drawing = drawing.replace('</mxfile>', `${contextPage()}\n</mxfile>`);
writeFileSync(target, drawing, 'utf8');
console.log('Wrote 01-domain-conceptual.drawio (5 UML pages; user layout preserved)');
