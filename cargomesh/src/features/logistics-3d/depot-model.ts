import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Euler, RepeatWrapping, SphereGeometry, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { depotTemplate, type DepotTemplateId } from './depot-templates';

/** Original procedural depot; all dimensions are visual, not facility survey data. */
export function buildDepot(color = "#0a9292", templateId: DepotTemplateId = 'distribution') {
  const template = depotTemplate(templateId), depth = template.depth, width = template.bays * 4, middle = -3 + width / 2;
  const campus = !['compact', 'solar', 'cooling', 'workshop', 'transfer'].includes(template.feature);
  const bayXs = Array.from({ length: template.bays }, (_, index) => -1 + index * 4);
  const root = new Group(), roof = new Group(), barrier = new Group(), exitBarrier = new Group(), shutters = bayXs.map(() => new Group());
  root.add(roof, barrier, exitBarrier, ...shutters);
  const colors = { pavement:"#465360",concrete:"#c9cec7",wall:template.wall,steel:"#718494",accent:color,glass:"#3788a6",roof:template.roof,gold:"#eab35a",white:"#f1f2df",green:"#76a576",dark:"#1c3445",wood:"#b78352",box:"#d9b47a",red:"#d76053",water:"#5c9aaa" };
  type Key = keyof typeof colors;
  const material = new Map<Key,MeshStandardMaterial>();
  const pools = new Map<Group,Map<Key,BufferGeometry[]>>();
  const add = (geometry:BufferGeometry,key:Key,x:number,y:number,z:number,target=root,rotation:[number,number,number]=[0,0,0]) => {
    const matrix=new Matrix4().compose(new Vector3(x,y,z),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(1,1,1));
    const piece=geometry.index?geometry.toNonIndexed():geometry.clone();piece.applyMatrix4(matrix);geometry.dispose();
    let pool=pools.get(target);if(!pool){pool=new Map();pools.set(target,pool);}const list=pool.get(key)??[];list.push(piece);pool.set(key,list);
  };
  const box=(key:Key,x:number,y:number,z:number,w:number,h:number,d:number,target=root)=>add(new BoxGeometry(w,h,d),key,x,y,z,target);
  const cylinder=(key:Key,x:number,y:number,z:number,r:number,h:number,target=root)=>add(new CylinderGeometry(r,r,h,10),key,x,y,z,target);
  // Raised site, road and separated landscaped verges.
  box("concrete",0,-.32,1,30,.6,24);box("green",0,.01,1,29.6,.05,23.6);
  box("pavement",0,.07,9,42,.13,6);box("concrete",2,.06,-1,24,.12,17);
  box("pavement",1,.14,4.5,23,.1,10);box("concrete",0,.19,6,25,.15,.28);
  for(let x=-20;x<21;x+=2.7)box("white",x,.15,9,.95,.02,.08);
  for(let z=-6;z<7;z+=1.3) { box("white",-9,.21,z,2.6,.02,.08);box("white",-10.3,.21,z,.08,.02,1.3); }
  if (!campus) {
  // Continuous facade with three real dock apertures; no gaps between the bays.
  box("concrete",middle,.27,1-depth/2,width,.2,depth);box("wall",middle,2.05,1-depth,width,3.6,.18);
  box("wall",-3,2.05,1-depth/2,.18,3.6,depth);box("wall",-3+width,2.05,1-depth/2,.18,3.6,depth);
  const facade = [[-2.49,1.02], ...bayXs.slice(0,-1).map(x => [x+2,2.08]), [-3+width-.51,1.02]];
  for(const [x,w] of facade){
    box("wall",x,2.05,1,w,3.6,.2);
    for(let dx=-w/2+.12;dx<w/2;dx+=.18)box("concrete",x+dx,2.05,1.115,.025,3.58,.035);
  }
  box("wall",middle,3.24,1,width,1.22,.2);
  box("steel",middle,3.83,1.16,width,.08,.12);
  box("steel",middle,2.69,1.65,width,.09,1.05);
  for(const [index,x] of bayXs.entries()){
    for(const side of [-1,1])box("wall",x+side*1.25,1.9,1,.42,3.3,.2);
    box("wall",x,3.5,1,2.6,.45,.2);
    shutters[index].position.set(x, .35, .94);
    box("steel",0,1.14,0,1.9,2.28,.08,shutters[index]);
    for(let h=.12;h<2.3;h+=.16)box("dark",0,h,.052,1.88,.016,.025,shutters[index]);
    box("steel",x,.52,1.55,2.2,.55,1.1);box("dark",x,.65,2.12,1.8,.13,.16);
    box("gold",x-.96,1.2,1.16,.16,1.8,.18);box("gold",x+.96,1.2,1.16,.16,1.8,.18);
    box("accent",x,2.7,1.15,1.9,.24,.12);cylinder("green",x+.72,2.7,1.23,.055,.06);
    for(const side of [-1,1])box("gold",x+side*1.1,.21,4.4,.07,.025,5.2);
    box("gold",x,.21,6.9,2.2,.025,.07);
  }
  // Office wing, entry glazing and shaded walkway.
  box("accent",-5.5,1.3,-4,4.6,2.5,5.8);box("roof",-5.5,2.67,-4,5,.18,6.2);
  for(let x=-7;x<-3.7;x+=.8){box("glass",x,1.75,-1.04,.62,.85,.06);box("white",x,1.3,-1.08,.69,.05,.08);}
  box("glass",-5.5,.9,-1.01,.75,1.5,.08);box("steel",-5.5,1.8,-.45,1.2,.1,1.4);
  for(let z=-6;z<0;z+=.85)box("glass",-7.83,1.6,z,.05,.95,.6);
  // Roof seam strips, skylights, ventilation and solar panels.
  box("roof",middle,3.99,1-depth/2,width+.5,.22,depth+.6,roof);
  for(let x=-2.6;x<-3+width;x+=.55)box("steel",x,4.13,1-depth/2,.035,.05,depth+.5,roof);
  for(const x of bayXs)for(const z of (depth<6?[-2]:[-5.2,-2.8])){box("dark",x,4.15,z,2.45,.1,1.5,roof);box("glass",x,4.21,z,2.3,.03,1.35,roof);for(let i=-.9;i<1.1;i+=.45)box("steel",x+i,4.24,z,.02,.025,1.4,roof);}
  for(const x of bayXs){box("concrete",x,4.29,-.1,.8,.4,.6,roof);box("dark",x,4.51,-.1,.65,.025,.45,roof);}
  // Shelf rows and pallet loads become visible in the roofless view.
  for(const x of [-1,.9,5.3,8])for(const z of (depth<6?[-3.4]:[-5.8,-3.8])){
    for(const side of [-.65,.65])box("steel",x+side,1.7,z,.055,2.8,.8);
    for(const y of [.7,1.7,2.7]){box("accent",x,y,z,1.5,.07,.9);for(const dx of [-.38,.38]){box("wood",x+dx,y+.1,z,.66,.1,.65);box("box",x+dx,y+.42,z,.58,.54,.56);box("gold",x+dx,y+.7,z,.06,.02,.56);}}
  }
  // Exterior staging pallets and container with ribbed sides.
  for(const x of [7,8.2,9.4]){box("wood",x,.31,4.5,.85,.2,.85);box("box",x,.85,4.5,.7,.9,.7);box("white",x,.85,4.14,.045,.9,.025);}
  if(template.feature!=='transfer'){
    box("accent",11,1.35,-4,2.4,2.3,5.5);for(let z=-6.6;z<-1.3;z+=.22)box("steel",9.78,1.35,z,.035,2.2,.04);
    box("dark",11,1.4,-1.22,2.2,2.05,.09);box("steel",11,1.4,-1.15,.06,2,.05);
  }
  if(template.feature==='cooling'){
    for(const x of [-.8,3.1,7]){box('white',x,4.55,-4,1.8,.8,1.5,roof);for(const dx of [-.45,.45]){cylinder('dark',x+dx,4.98,-4,.32,.035,roof);cylinder('steel',x+dx,5.01,-4,.1,.03,roof);}box('steel',x,4.26,-2.1,.12,.1,2.2,roof);}
    for(let x=-2.6;x<8.8;x+=.35)box('white',x,3.22,1.13,.025,1.12,.025);
  }
  if(template.feature==='workshop'){
    box('roof',6.8,3.15,3.2,4.2,.1,3.1);for(const x of [4.8,8.8])cylinder('gold',x,1.65,4.65,.055,3);
    for(const z of [-4.2,-2.2]){box('accent',7,.65,z,1.5,1,1);for(let y=.3;y<1;y+=.2)box('steel',7,y,z+.51,1.3,.025,.025);}
    for(const x of [6.4,7.6]){box('gold',x,.3,3.8,.18,.12,2.5);box('dark',x,.39,3.8,.1,.08,2.2);}
  }
  if(template.feature==='transfer'){
    box('roof',11,3.35,3.15,3.6,.14,3.8);for(const x of [9.4,12.6])cylinder('steel',x,1.8,4.8,.055,3.25);
    for(let z=-5.5;z<0;z+=.8)box('gold',11,.39,z,1.7,.08,.06);
  }
  } else {
    // The common front lane keeps the illustrative five-truck choreography clear.
    const building = (name: string) => { const group = new Group(); group.name = name; root.add(group); return group; };
    const dock = (index: number, x: number, z: number, rear = false, enclosed = false) => {
      const sign = rear ? -1 : 1, shutter = shutters[index];
      shutter.position.set(x, .35, z - sign * .06); shutter.rotation.y = rear ? Math.PI : 0;
      box('steel', 0, 1.14, 0, 1.9, 2.28, .08, shutter);
      for (let y = .12; y < 2.3; y += .16) box('dark', 0, y, .052, 1.88, .016, .025, shutter);
      for (const side of [-1, 1]) {
        box('dark', x + side * 1.06, 1.6, z + sign * .12, .17, 2.6, .24);
        cylinder('gold', x + side * 1.3, .85, z + sign * 1.35, .07, 1.3);
        box('gold', x + side * 1.1, .21, z + sign * 3.4, .07, .025, 4.8);
        if (enclosed) box('wall', x + side * 1.2, 1.77, z + sign * .75, .18, 2.85, 1.6);
      }
      box('accent', x, 2.9, z + sign * .15, 2.15, .25, .2);
      box('steel', x, .52, z + sign * .55, 2.2, .55, 1.1);
      box('dark', x, .65, z + sign * 1.12, 1.8, .13, .16);
      if (enclosed) {
        box('roof', x, 3.25, z + sign * .75, 2.6, .18, 1.7, roof);
        box('dark', x, 2.85, z + sign * 1.52, 2.25, .43, .12);
      }
    };
    const hall = (target: Group, hallDepth: number, height: number, rearDocks = false) => {
      box('concrete', 3, .28, 1 - hallDepth / 2, 12, .25, hallDepth, target);
      for (const x of [-3, 9]) box('wall', x, (height + .35) / 2, 1 - hallDepth / 2, .2, height - .35, hallDepth, target);
      const facades = rearDocks ? [1, 1 - hallDepth] : [1];
      if (!rearDocks) box('wall', 3, (height + .35) / 2, 1 - hallDepth, 12, height - .35, .2, target);
      for (const z of facades) {
        for (const [x, w] of [[-2.5, 1], [1, 2], [5, 2], [8.5, 1]]) box('wall', x, 1.6, z, w, 2.5, .2, target);
        box('wall', 3, (height + 2.65) / 2, z, 12, height - 2.65, .2, target);
      }
    };
    const railing = (x: number, y: number, z: number, span: number, target = root) => {
      box('steel', x, y + .6, z, span, .045, .045, target);
      box('steel', x, y + .3, z, span, .035, .035, target);
      for (let dx = -span / 2; dx <= span / 2 + .01; dx += span / 4) cylinder('steel', x + dx, y + .3, z, .025, .6, target);
    };
    if (template.feature === 'cross-dock') {
      const sorting = building('Cross-dock sorting hall'); hall(sorting, 7, 4.45, true);
      for (let i = 0; i < 3; i++) { dock(i, -1 + i * 4, 1); dock(i + 3, -1 + i * 4, -6, true); }
      for (const x of [-1, 3, 7]) {
        add(new BoxGeometry(4.1, .16, 7.4), 'roof', x, 4.8, -2.5, roof, [0, 0, .16]);
        box('glass', x - 1.95, 4.73, -2.5, .06, .62, 7.3, roof);
        for (let z = -5.6; z < 1; z += 1.1) box('steel', x - 1.98, 4.7, z, .09, .8, .055, roof);
      }
      const control = building('Two-storey distribution control wing');
      box('wall', 10.8, 2.7, -3.4, 3.3, 5.1, 5.8, control);
      for (const y of [1.35, 3.9]) {
        box('glass', 10.8, y, -.46, 2.9, 1.45, .06, control);
        box('glass', 12.49, y, -3.4, .06, 1.45, 5.1, control);
      }
      box('steel', 10.8, 2.7, -.42, 3.4, .18, .25, control);
      box('roof', 10.8, 5.35, -3.4, 3.6, .16, 6.1, roof);
      const sortingLine = building('Sorting mezzanine and conveyors');
      box('steel', 3, 2.45, -3, 9.6, .18, 1.2, sortingLine); railing(3, 2.54, -2.42, 9.6, sortingLine);
      for (const x of [-1.5, 2.8, 7.5]) cylinder('gold', x, 1.36, -3, .06, 2.3, sortingLine);
      for (let x = -1; x < 8; x += .4) add(new CylinderGeometry(.07, .07, 1.1, 8), 'steel', x, .95, -1.8, sortingLine, [Math.PI / 2, 0, 0]);
      for (const x of [-.5, 2.3, 5.8]) box('box', x, 1.24, -1.8, .65, .45, .7, sortingLine);
    } else if (template.feature === 'service-yard') {
      const workshop = building('Service workshop'); hall(workshop, 6, 3.8);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1);
      box('roof', 3, 3.96, -2, 12.4, .2, 6.5, roof);
      for (const x of [-1, 3, 7]) {
        box('glass', x, 4.09, -2.2, 1.2, .08, 3.5, roof);
        box('dark', x, .42, -2.1, .85, .06, 3.6, workshop);
        for (const side of [-1, 1]) {
          box('gold', x + side * .62, .47, -2.1, .1, .08, 3.8, workshop);
          box('accent', x + side * 1.1, 1.5, -3, .18, 2.35, .22, workshop);
          box('steel', x + side * .76, .79, -3, .55, .1, .18, workshop);
        }
        box('red', x, .95, -4.55, 1.6, 1.1, .55, workshop);
        for (const y of [.65, .9, 1.15]) box('steel', x, y, -4.25, 1.4, .025, .03, workshop);
      }
      const parking = building('Covered parking courts');
      box('roof', -10.4, 3.5, -2.3, 4.3, .12, 10.7, roof);
      for (const x of [-12.3, -8.5]) for (const z of [-7.2, 2.6]) cylinder('steel', x, 1.85, z, .06, 3.3, parking);
      for (const z of [-6.5, -4.3, -2.1, .1, 2.3]) box('white', -10.4, .22, z, 3.7, .02, .08, parking);
      const office = building('Separate yard administration');
      box('wall', -5.4, 1.4, -6.3, 4, 2.5, 2.6, office);
      box('glass', -5.4, 1.7, -4.96, 3.45, 1.1, .06, office);
      box('roof', -5.4, 2.77, -6.3, 4.3, .16, 2.9, roof);
      for (const z of [-4.8, -2.6, -.4]) { box('dark', 11, .4, z, 1.4, .25, .8); box('steel', 11, .65, z, 1.15, .25, .7); }
    } else if (template.feature === 'cold-campus') {
      const cold = building('Insulated cold storage'); hall(cold, 8, 4.1);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1, false, true);
      const chambers = building('Three insulated chambers');
      for (const x of [-1, 3, 7]) {
        for (const side of [-1, 1]) box('wall', x + side * 1.72, 1.95, -4, .22, 3.15, 4.9, chambers);
        box('wall', x, 1.95, -6.5, 3.65, 3.15, .22, chambers);
        box('steel', x, .4, -4, 3.3, .06, 4.8, chambers);
        box('glass', x, 1.7, -1.48, 2.5, 2.6, .12, chambers);
        box('accent', x, 3.17, -1.42, 2.7, .16, .15, chambers);
        for (const z of [-5.7, -3.5]) { box('steel', x, .75, z, 2.5, .09, 1.05, chambers); box('white', x, 1.1, z, 2.2, .6, .85, chambers); }
      }
      box('roof', 3, 4.25, -3, 12.5, .25, 8.4, roof);
      const plant = building('Separate refrigeration plant');
      box('steel', -5.1, 1.6, -3.5, 3.4, 2.8, 5.7, plant);
      box('roof', -5.1, 3.12, -3.5, 3.7, .2, 6, roof);
      for (const x of [-.8, 3.2, 7]) {
        box('white', x, 4.78, -4.2, 2.1, .8, 2.2, roof);
        for (const z of [-4.75, -3.65]) { cylinder('dark', x, 5.21, z, .4, .06, roof); cylinder('steel', x, 5.26, z, .12, .035, roof); }
      }
      for (const z of [-5.2, -3.5, -1.8]) {
        box('dark', -6.84, 1.6, z, .05, 1.8, 1.2, plant);
        add(new CylinderGeometry(.11, .11, 8.4, 10), 'steel', -.9, 4.51, z, roof, [0, 0, Math.PI / 2]);
      }
    } else if (template.feature === 'silo-terminal') {
      const apron = building('Covered bulk bagging apron');
      box('wall', 3, 1.6, -1.2, 12, 2.6, .18, apron);
      for (let i = 0; i < 3; i++) { const x = -1 + i * 4; dock(i, x, 1); box('steel', x, 1.9, -.1, .1, 3.3, .1, apron); }
      box('roof', 3, 3.55, -.1, 12.8, .18, 3.1, roof);
      const silos = building('Six-silo battery');
      for (const x of [-1.2, 3.1, 7.4]) for (const z of [-3.4, -7]) {
        add(new CylinderGeometry(1.15, 1.15, 3.9, 24), 'white', x, 4.3, z, silos);
        add(new CylinderGeometry(.05, 1.18, .75, 24), 'steel', x, 6.62, z, silos);
        add(new CylinderGeometry(1.14, .21, 1.35, 24), 'steel', x, 1.68, z, silos);
        cylinder('dark', x, .85, z, .17, .35, silos);
        for (const dx of [-.88, .88]) for (const dz of [-.75, .75]) box('steel', x + dx, 1.27, z + dz, .1, 2.1, .1, silos);
        for (let y = 1.3; y < 6.2; y += .33) box('steel', x + 1.2, y, z, .045, .025, .5, silos);
        for (const side of [-1, 1]) cylinder('gold', x + 1.2, 3.75, z + side * .27, .025, 5.2, silos);
        box('accent', x, 4.2, z + 1.16, .7, .65, .04, silos);
      }
      const conveyor = building('Elevated conveyor bridge');
      box('dark', 4.4, 6.3, -5.2, 14.3, .35, .9, conveyor); railing(4.4, 6.5, -4.65, 14.3, conveyor);
      for (const x of [-2.4, 2.8, 8.2, 11.3]) { cylinder('steel', x, 3.35, -5.2, .07, 6.1, conveyor); box('gold', x, 6.3, -5.2, .08, .05, 1.1, conveyor); }
      box('wall', 11, 2.65, -4.5, 2.5, 4.9, 4, conveyor); box('roof', 11, 5.18, -4.5, 2.8, .16, 4.3, roof);
    } else if (template.feature === 'industrial-plant') {
      const production = building('Industrial production hall'); hall(production, 8, 4.8);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1);
      for (const x of [-.6, 4.8]) for (const z of [-4.8, -2.4]) {
        box('steel', x, 1.2, z, 2.6, 1.6, 1.2, production); box('accent', x, 1.95, z, 1.8, .3, .9, production);
        cylinder('gold', x + .8, 2.25, z, .13, .4, production);
        box('dark', x - .8, 1.55, z + .63, .45, .4, .04, production);
      }
      for (const side of [-1, 1]) add(new BoxGeometry(6.35, .18, 8.5), 'roof', 3 + side * 3.05, 5.3, -3, roof, [0, 0, -side * .17]);
      for (const x of [1.2, 4.8]) { cylinder('steel', x, 5.4, -6, .3, 3.8, roof); cylinder('dark', x, 7.35, -6, .38, .12, roof); }
      const warehouse = building('Separate industrial warehouse');
      box('wall', -5.5, 1.9, -4.6, 4.4, 3.3, 6.4, warehouse); box('dark', -5.5, 1.5, -1.36, 2.6, 2.5, .06, warehouse);
      box('roof', -5.5, 3.7, -4.6, 4.7, .2, 6.7, roof);
      const loading = building('Industrial loading gantry');
      for (const x of [9.7, 12.2]) cylinder('gold', x, 2.3, -3.8, .12, 4.1, loading);
      box('steel', 10.95, 4.4, -3.8, 3, .35, .5, loading); box('dark', 10.95, 3.75, -3.8, .15, 1, .15, loading);
    } else if (template.feature === 'agricultural-hub') {
      const sheds = building('Open agricultural crop sheds');
      for (const x of [-5.4, 7.1]) {
        for (const dx of [-1.9, 1.9]) for (const z of [-7, -2]) box('wood', x + dx, 1.8, z, .16, 3, .16, sheds);
        box('wall', x, .65, -7.2, 4.2, .8, .15, sheds);
        for (const side of [-1, 1]) add(new BoxGeometry(2.25, .12, 5.8), 'roof', x + side * 1.05, 3.7, -4.5, roof, [0, 0, -side * .22]);
        for (const z of [-6.2, -4.5]) for (const dx of [-1.1, .8]) {
          box('wood', x + dx, .7, z, 1.35, .75, 1.2, sheds);
          for (let j = 0; j < 3; j++) add(new SphereGeometry(.18, 7, 5), 'green', x + dx - .4 + j * .4, 1.15, z, sheds);
        }
      }
      const receiving = building('Crop reception and weighbridge');
      for (let i = 0; i < 3; i++) { dock(i, -1 + i * 4, 1); box('wood', -1 + i * 4, 2.75, .1, 2.5, .2, 2.8, receiving); }
      box('steel', 3, .38, -2.7, 2.3, .2, 4.7, receiving);
      for (const z of [-5.4, -2.6]) { add(new CylinderGeometry(.8, .25, 1.1, 8), 'gold', 3, 1.4, z, receiving); cylinder('steel', 3, .65, z, .12, .8, receiving); }
      const sorting = building('Produce classification line');
      box('wall', 1.2, 1.35, -7.4, 5.2, 2.1, 1.5, sorting); box('glass', 1.2, 1.6, -6.62, 4.7, .9, .05, sorting);
      box('roof', 1.2, 2.5, -7.4, 5.6, .15, 1.9, roof);
      for (let x = -.7; x < 3.5; x += .35) add(new CylinderGeometry(.07, .07, 1.05, 8), 'steel', x, .95, -5.9, sorting, [Math.PI / 2, 0, 0]);
    } else if (template.feature === 'retail-store') {
      const receiving = building('Retail rear receiving warehouse'); hall(receiving, 3.5, 3.4);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1);
      box('roof', 3, 3.55, -.75, 12.5, .2, 3.9, roof);
      const store = building('Glazed supermarket sales floor');
      box('concrete', 3, .3, -5.25, 12, .2, 5.3, store);
      for (const x of [-3, 9]) box('glass', x, 2.15, -5.25, .08, 3.7, 5.3, store);
      box('glass', 3, 2.15, -7.9, 12, 3.7, .08, store);
      for (let x = -2.5; x < 9; x += 1.4) box('white', x, 2.15, -7.96, .07, 3.75, .08, store);
      box('roof', 3, 4.2, -5.25, 12.4, .25, 5.7, roof);
      const entrance = building('Public retail entrance');
      box('accent', 3, 3.3, -8.04, 7, .55, .16, entrance);
      for (const x of [1.8, 4.2]) box('steel', x, 1.65, -8.04, .08, 2.7, .12, entrance);
      box('glass', 3, 1.65, -8.02, 2.3, 2.7, .08, entrance);
      box('roof', 3, 3, -8.25, 7.5, .15, 1.2, roof);
      box('concrete', 3, .22, -8.45, 13, .08, .8);
      box('concrete', -7.4, .22, -.4, 1.2, .08, 17);
      const aisles = building('Retail sales aisles and checkouts');
      for (const x of [-.8, 3, 6.8]) for (const z of [-6.2, -4.2]) { box('steel', x, .95, z, .65, 1.2, 1.4, aisles); for (const y of [.6, 1, 1.4]) box('gold', x, y, z, .85, .05, 1.5, aisles); }
      for (const x of [0, 6]) { box('accent', x, .8, -7.2, 1.2, .9, .65, aisles); box('dark', x, 1.45, -7.2, .35, .4, .08, aisles); }
    } else if (template.feature === 'pharmaceutical-centre') {
      const receiving = building('Controlled pharmaceutical receiving'); hall(receiving, 8, 4);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1, false, true);
      box('roof', 3, 4.15, -3, 12.5, .25, 8.4, roof);
      const rooms = building('Separated pharmaceutical storage rooms');
      for (const x of [-1, 3, 7]) {
        for (const dx of [-1.7, 1.7]) box('wall', x + dx, 1.95, -4.7, .18, 3.2, 4.3, rooms);
        box('glass', x, 1.9, -2.5, 3.3, 3, .1, rooms); box('accent', x, 1.5, -2.42, .85, 2.2, .07, rooms);
        for (const z of [-4, -5.7]) { box('steel', x, 1.5, z, 2.4, 2.4, .65, rooms); for (const y of [.7, 1.5, 2.3]) box('white', x, y, z, 2.5, .06, .7, rooms); }
      }
      const corridor = building('Glazed controlled access corridor');
      box('glass', -5.2, 1.8, -3.1, 3.5, 3, 7.8, corridor); box('roof', -5.2, 3.5, -3.1, 3.9, .22, 8.2, roof);
      for (const z of [-6.4, -3.1, .6]) box('white', -7, 1.8, z, .1, 3.2, .12, corridor);
      box('dark', -5.2, 1.45, .9, 1.3, 2.3, .12, corridor);
      for (const x of [0, 6]) { box('steel', x, 4.65, -4.5, 3.3, .75, 2, roof); for (let z = -5.2; z < -3.6; z += .3) box('dark', x, 5.04, z, 3, .03, .08, roof); }
    } else if (template.feature === 'fulfilment-centre') {
      const picking = building('Fulfilment picking aisles'); hall(picking, 8, 4.6);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1);
      for (const x of [-1.4, 1.1, 6.5]) for (const z of [-5.8, -3.4]) {
        for (const dx of [-.7, .7]) box('steel', x + dx, 1.9, z, .07, 3, 1.3, picking);
        for (const y of [.7, 1.6, 2.5]) { box('accent', x, y, z, 1.5, .07, 1.2, picking); for (const dx of [-.38, .38]) box('box', x + dx, y + .3, z, .6, .5, .9, picking); }
      }
      const mezzanine = building('Elevated order packing stations');
      box('wall', -5.3, 2.7, -4.1, 4.2, 4.8, 6.3, mezzanine); box('glass', -5.3, 3.9, -.9, 3.7, 1.4, .08, mezzanine);
      box('roof', -5.3, 5.25, -4.1, 4.6, .2, 6.7, roof);
      for (const z of [-5.5, -3, -1.4]) { box('steel', -5.2, 2.95, z, 2.7, .14, 1, mezzanine); box('dark', -6, 3.3, z, .4, .6, .05, mezzanine); }
      const sorting = building('Parcel sorting and dispatch conveyors');
      for (let z = -6; z < .2; z += .34) add(new CylinderGeometry(.065, .065, 1, 8), 'steel', 3.5, 1, z, sorting, [0, 0, Math.PI / 2]);
      for (const x of [-1, 3, 7]) { box('gold', x, .95, -.8, 2.2, .08, .8, sorting); box('box', x, 1.25, -.8, .7, .5, .6, sorting); }
      for (const x of [-.5, 3, 6.5]) { box('roof', x, 4.8, -3, 3.55, .2, 8.4, roof); box('glass', x, 4.95, -3, .8, .08, 6.5, roof); }
    } else if (template.feature === 'urban-courtyard') {
      const dispatch = building('Compact L-shaped dispatch hall'); hall(dispatch, 4.5, 3.35);
      for (let i = 0; i < 3; i++) dock(i, -1 + i * 4, 1);
      box('roof', 3, 3.5, -1.25, 12.4, .18, 4.9, roof);
      const tower = building('Two-level urban dispatch office');
      box('wall', -.1, 3, -5.1, 5.8, 5.6, 3.5, tower);
      for (const y of [1.5, 4.2]) {
        box('glass', -.1, y, -6.88, 5.25, 1.5, .06, tower);
        box('glass', -3.04, y, -5.1, .06, 1.5, 3, tower);
        for (let x = -2.3; x < 2.5; x += .8) box('white', x, y, -6.94, .045, 1.6, .06, tower);
      }
      box('roof', -.1, 5.92, -5.1, 6.1, .2, 3.8, roof);
      for (let step = 0; step < 12; step++) box('steel', -1.95, .4 + step * .24, -1.7 - step * .25, 1.2, .14, .32, tower);
      const terrace = building('Urban roof terrace and courier court');
      box('green', 6, 3.65, -1.35, 5.1, .08, 3.5, roof); railing(6, 3.73, .35, 5.3, roof); railing(6, 3.73, -3.1, 5.3, roof);
      for (const x of [4.1, 7.8]) for (const z of [-2.5, -.1]) {
        box('concrete', x, 3.88, z, .65, .35, .65, roof);
        add(new SphereGeometry(.3, 8, 6), 'green', x, 4.19, z, roof);
      }
      box('wall', 10.8, 1.45, -1.8, 3.2, 2.55, 3.8, terrace);
      box('glass', 10.8, 1.6, .14, 2.85, 2.2, .06, terrace);
      box('roof', 10.8, 2.86, -1.8, 3.5, .2, 4.1, roof);
      for (const x of [10, 11.5]) { box('accent', x, .9, 3.1, .3, 1.3, .35, terrace); box('glass', x, 1.1, 3.29, .2, .35, .03, terrace); }
      for (const z of [-6, -3.5, -1]) { box('concrete', -10.6, .27, z, 3.2, .12, 1.85, terrace); box('white', -10.6, .34, z, 2.6, .02, .06, terrace); }
    }
  }
  // Gate cabin and barrier. Pivot at the lane edge, outside the truck envelope.
  box("accent",-7.6,.65,5.8,1.55,1.2,1.2);box("glass",-7.6,.91,6.42,1.2,.55,.05);box("roof",-7.6,1.31,5.8,1.8,.14,1.5);
  cylinder("gold",-7.5,.66,6.95,.15,1.1);barrier.position.set(-7.5,1.2,6.95);
  box("white",0,0,2.05,.12,.12,4.1,barrier);for(let z=.35;z<4;z+=.6)box("red",0,0,z,.13,.13,.28,barrier);
  cylinder("gold",12,.66,6.95,.15,1.1);exitBarrier.position.set(12,1.2,6.95);
  box("white",0,0,2.05,.12,.12,4.1,exitBarrier);for(let z=.35;z<4;z+=.6)box("red",0,0,z,.13,.13,.28,exitBarrier);
  // Perimeter fence leaves a wide gated entrance.
  for(let x=-13;x<=13;x+=2){cylinder("steel",x,.83,-9,.04,1.4);box("steel",x,.45,-9,2,.035,.035);box("steel",x,1.25,-9,2,.035,.035);}
  for(let z=-8;z<5;z+=2){cylinder("steel",13,.83,z,.04,1.4);box("steel",13,.45,z,.035,.035,2);box("steel",13,1.25,z,.035,.035,2);}
  // Planters, trees, lamps, loading bay bollards and crosswalk.
  for(const [x,z] of (campus ? [[-12,-8],[-12,4],[11,6]] : [[-12,-7],[-12,-3],[-12,2],[11,3],[11,6],[7,-9],[2,-9]])){
    box("concrete",x,.25,z,1,.3,1);cylinder("wood",x,.92,z,.095,1.3);add(new SphereGeometry(.72,10,8),"green",x,1.95,z);add(new SphereGeometry(.5,10,8),"green",x+.28,2.35,z);
  }
  for(const [x,z] of [[-6,3],[6,6],[11,-8]]){cylinder("steel",x,1.8,z,.045,3.3);box("steel",x+.25,3.4,z,.5,.05,.04);box("gold",x+.4,3.35,z,.2,.05,.2);}
  for(let x=-5;x<-1;x+=.6)box("white",x,.21,5.9,.28,.025,1.3);
  if (!campus) {
  // Packing benches, roller line, office signage and marked pedestrian aisles.
  for(const [x,z] of [[-.6,-1.8],[5.7,3.25]]){box("steel",x,.92,z,1.8,.12,1);for(const dx of [-.7,.7])for(const dz of [-.38,.38])box("steel",x+dx,.56,z+dz,.065,.72,.065);box("box",x-.4,1.2,z,.5,.46,.45);box("dark",x+.6,1.12,z-.2,.24,.35,.06);}
  for(let z=-5.8;z<-2.5;z+=.25){add(new CylinderGeometry(.055,.055,1.2,10),"steel",6.7,.79,z,root,[0,0,Math.PI/2]);}
  for(const x of [6.06,7.34]){box("gold",x,.82,-4.2,.055,.08,3.8);for(const z of [-5.8,-2.5])box("steel",x,.56,z,.08,.5,.08);}
  for(let z=-5;z<4;z+=.65){box("green",5.55,.23,z,.045,.015,.3);box("green",6.15,.23,z,.045,.015,.3);}
  box("accent",-5.5,2.28,-1.1,3.7,.4,.08);box("white",-5.5,2.29,-1.15,2.8,.055,.025);
  for(const x of [-1,3,7]){for(let i=0;i<6;i++)box("gold",x-.7+i*.28,.81,1.92,.12,.02,.18);box("glass",x+.97,2.73,1.23,.05,.08,.025);}
  // Safety rails, hose reels, drains and fire equipment make the dock legible.
  for(const x of [-2,8.8]){box("red",x,.8,1.25,.16,.65,.12);box("white",x,.94,1.33,.12,.04,.025);cylinder("steel",x,1.32,1.25,.1,.07);}
  for(let x=-8;x<11;x+=.45)box("dark",x,.23,5.12,.18,.014,.025);
  box("gold",4.8,.32,2.65,1.2,.1,1.2);for(let i=0;i<6;i++)box("dark",4.3+i*.18,.39,2.65,.07,.02,1);
  }
  const grain=typeof document!=="undefined"?surfaceGrain():null;
  for(const [target,pool] of pools)for(const [key,pieces] of pool){let mat=material.get(key);if(!mat){mat=new MeshStandardMaterial({color:colors[key],roughness:key==="glass"?.16:key==="pavement"?.94:.7,metalness:key==="steel"?.65:key==="roof"?.35:key==="glass"?.3:0});if(grain&&["pavement","concrete","wall"].includes(key)){mat.bumpMap=grain;mat.bumpScale=key==="pavement"?.05:.018;mat.roughnessMap=grain;}material.set(key,mat);}const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(merged){const mesh=new Mesh(merged,mat);mesh.castShadow=key!=="green";mesh.receiveShadow=true;target.add(mesh);}}
  root.userData.source="cargomesh-original-depot";root.userData.templateId=templateId;root.userData.visualDockCount=template.bays;
  return {root,roof,barrier,exitBarrier,shutters};
}
function surfaceGrain(){const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;const context=canvas.getContext("2d");if(context){const pixels=context.createImageData(128,128);let seed=7919;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=150+seed%70;pixels.data.set([value,value,value,255],i);}context.putImageData(pixels,0,0);}const texture=new CanvasTexture(canvas);texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(12,12);return texture;}
export function disposeDepot(root:Group){const materials=new Set<MeshStandardMaterial>(),textures=new Set<CanvasTexture>();root.traverse(node=>{if(node instanceof Mesh){if(node instanceof InstancedMesh)node.dispose();node.geometry.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material])materials.add(mat as MeshStandardMaterial);}});materials.forEach(mat=>{for(const texture of [mat.map,mat.bumpMap,mat.roughnessMap])if(texture)textures.add(texture as CanvasTexture);mat.dispose();});textures.forEach(texture=>texture.dispose());}
