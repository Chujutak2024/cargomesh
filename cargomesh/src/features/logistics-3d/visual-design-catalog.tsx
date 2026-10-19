'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Search, Truck } from 'lucide-react';
import { LogisticsTruck } from './logistics-truck';
import { truckDesigns, type TruckDesign } from './visual-catalog';
import { truckVisualTypes } from './truck-model';
import s from './visual-designs.module.css';

export function VisualDesignCatalog({ selectedId, onSelect, openYard }: { selectedId: string; onSelect: (id: string) => void; openYard: () => void }) {
  const [family, setFamily] = useState('new'), [query, setQuery] = useState('');
  const selected = truckDesigns.find(design => design.id === selectedId) ?? truckDesigns[0];
  const designs = useMemo(() => truckDesigns.filter(design => (family === 'new' ? !!design.appearance.bodyStyle : family === 'all' || design.family === family) && `${design.name} ${design.description}`.toLowerCase().includes(query.toLowerCase().trim())), [family, query]);
  return <section className={s.catalog} aria-label="Truck design catalog">
    <div className={s.catalogHeading}><div><h2>Truck designs</h2><p>{truckDesigns.length} designs, including five new body styles with their own geometry.</p></div><button className={s.linkButton} onClick={openYard}>Explore the depot <ArrowRight size={16}/></button></div>
    <div className={s.catalogLayout}>
      <div className={s.designViewer}><div className={s.selectedTitle}><span className={s.colorBlock} style={{ backgroundColor: selected.appearance.cab }}/><div><h3>{selected.name}</h3><p>{selected.description}</p></div></div>
        <LogisticsTruck variant={selected.family} designId={selected.id} label={selected.name}/>
        <dl className={s.designFacts}><div><dt>Equipment family</dt><dd>{selected.family}</dd></div><div><dt>Body design</dt><dd>{selected.appearance.bodyStyle ? selected.name : selected.appearance.fittings?.join(' · ') || 'Standard'}</dd></div></dl>
        <p className={s.note}>Visual designs do not create fleet records or establish equipment capacity. New body styles require the 3D viewer; the original designs retain their family preview images.</p>
      </div>
      <div className={s.designList}>
        <div className={s.filters}><label><Search size={15} aria-hidden="true"/><span className={s.srOnly}>Search truck designs</span><input type="search" value={query} placeholder="Search designs" onChange={event => setQuery(event.target.value)}/></label><label><span className={s.srOnly}>Equipment family</span><select aria-label="Equipment family" value={family} onChange={event => setFamily(event.target.value)}><option value="new">5 new body styles</option><option value="all">All families</option>{truckVisualTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label></div>
        <p className={s.resultCount} role="status">{designs.length} of {truckDesigns.length} designs</p>
        {designs.length ? <ul className={s.designGrid}>{designs.map(design => <DesignItem key={design.id} design={design} selected={selected.id === design.id} onSelect={() => onSelect(design.id)}/>)}</ul> : <div className={s.empty}><h3>No matching designs</h3><p>Try another name or equipment family.</p><button onClick={() => { setFamily('all'); setQuery(''); }}>Clear filters</button></div>}
      </div>
    </div>
  </section>;
}
function DesignItem({ design, selected, onSelect }: { design: TruckDesign; selected: boolean; onSelect: () => void }) {
  return <li><button className={s.designItem} aria-pressed={selected} onClick={onSelect} data-design-id={design.id}><span className={s.designIcon} style={{ color: design.appearance.cab }}><Truck size={29} strokeWidth={1.6}/></span><span><strong>{design.name}</strong><small>{design.family}</small></span><span className={s.swatches} aria-hidden="true">{[design.appearance.cab, design.appearance.body, design.appearance.accent].map((color, i) => <i key={i} style={{ backgroundColor: color }}/>)}</span></button></li>;
}
