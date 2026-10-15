'use client';
/**
 * Family tree renderer (shared: website member portal + admin; admin keeps an identical copy, synced by
 * admin/scripts/sync-contracts.mjs). Generation rows, couples side by side joined by a small eight-point star,
 * children under their parents. Zoom, fit, and a list view (screen readers and phones).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { badgeFor, CARD, fullName, generations, layout, lifeYears, relationTo, visibleIds, type Family, type Person } from '@/lib/family/family';

type Props = {
  family: Family; today: string; recordDate: string;
  layer: 'membership' | 'whole'; onLayer?: (l: 'membership' | 'whole') => void;
  selected?: string | null; onSelect?: (id: string) => void;
  label?: string; extraTools?: ReactNode;
};
const GEN_NAME = (g: number) => g === 0 ? 'Your generation' : g === -1 ? 'Parents' : g === -2 ? 'Grandparents' : g < -2 ? `${'Great-'.repeat(-g - 2)}grandparents` : g === 1 ? 'Children' : g === 2 ? 'Grandchildren' : `${'Great-'.repeat(g - 2)}grandchildren`;

export function FamilyTree({ family, today, recordDate, layer, onLayer, selected, onSelect, label = 'Family tree', extraTools }: Props) {
  const L = useMemo(() => layout(family, layer), [family, layer]);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const box = useRef<HTMLDivElement>(null);
  const fitScale = () => { const w = box.current?.clientWidth ?? L.width; return Math.max(0.45, Math.min(1, (w - 8) / L.width)); };
  const fit = () => setScale(fitScale());
  // start readable: shrink to fit only down to 85%; wider trees scroll sideways (centered on "you")
  useEffect(() => { setScale(Math.max(0.85, fitScale())); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [L.width, view]);
  // bring "you" into view
  useEffect(() => {
    const me = L.nodes.find((n) => n.id === family.rootId); const el = box.current;
    if (me && el) el.scrollLeft = Math.max(0, (me.x + CARD.w / 2) * scale - el.clientWidth / 2);
  }, [L, scale, family.rootId]);

  const people = new Map(family.people.map((p) => [p.id, p]));
  const card = (p: Person) => {
    const b = badgeFor(p, today, recordDate);
    return (
      <>
        <span className={`ft-av t-${b.tone}`} aria-hidden="true">{((p.first?.[0] ?? '') + (p.last?.[0] ?? '')).toUpperCase() || '·'}</span>
        <span className="ft-txt">
          <b>{fullName(p)}</b>
          <small>{relationTo(family, p.id)}{lifeYears(p) ? ` · ${lifeYears(p)}` : ''}</small>
          <em className={`ft-badge t-${b.tone}`}>{b.text}</em>
        </span>
      </>
    );
  };

  return (
    <div className="ft">
      <div className="ft-tools">
        {onLayer && (
          <div className="ft-seg" role="radiogroup" aria-label="What to show">
            <button type="button" role="radio" aria-checked={layer === 'membership'} onClick={() => onLayer('membership')}>Membership family</button>
            <button type="button" role="radio" aria-checked={layer === 'whole'} onClick={() => onLayer('whole')}>Whole family + history</button>
          </div>
        )}
        <div className="ft-seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={view === 'tree'} onClick={() => setView('tree')}>Tree</button>
          <button type="button" role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
        {view === 'tree' && (
          <div className="ft-zoom">
            <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.45, +(s - 0.1).toFixed(2)))}>−</button>
            <span aria-live="polite">{Math.round(scale * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(1.4, +(s + 0.1).toFixed(2)))}>+</button>
            <button type="button" onClick={fit}>Fit</button>
          </div>
        )}
        {extraTools}
      </div>

      {view === 'tree' ? (
        <div className="ft-scroll" ref={box} role="group" aria-label={label}>
          <div className="ft-sizer" style={{ width: L.width * scale, height: L.height * scale }}>
            <div className="ft-canvas" style={{ width: L.width, height: L.height, transform: `scale(${scale})` }}>
              <svg className="ft-lines" width={L.width} height={L.height} aria-hidden="true">
                {L.links.map((d, i) => <path key={i} d={d} />)}
                {L.couples.map((c, i) => (
                  <g key={`c${i}`}>
                    <path className="ft-couple" d={`M${c.x1},${c.y}H${c.x2}`} />
                    <g transform={`translate(${(c.x1 + c.x2) / 2} ${c.y})`} className="ft-knot">
                      <rect x="-5" y="-5" width="10" height="10" /><rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" />
                    </g>
                  </g>
                ))}
              </svg>
              {L.nodes.map((n) => {
                const p = people.get(n.id)!;
                return (
                  <button key={n.id} type="button" className={`ft-card${n.id === family.rootId ? ' is-root' : ''}${selected === n.id ? ' is-sel' : ''}${p.died ? ' is-late' : ''}`}
                    style={{ left: n.x, top: n.y, width: CARD.w, height: CARD.h }} aria-pressed={selected === n.id} onClick={() => onSelect?.(n.id)} data-person={n.id}>
                    {card(p)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <FamilyList family={family} layer={layer} selected={selected} onSelect={onSelect} render={card} />
      )}
    </div>
  );
}

function FamilyList({ family, layer, selected, onSelect, render }: { family: Family; layer: 'membership' | 'whole'; selected?: string | null; onSelect?: (id: string) => void; render: (p: Person) => ReactNode }) {
  const gen = generations(family); const show = visibleIds(family, layer);
  const groups = [...new Set([...show].map((id) => gen.get(id)!))].sort((a, b) => a - b);
  return (
    <div className="ft-list">
      {groups.map((g) => (
        <section key={g} aria-label={GEN_NAME(g)}>
          <h3>{GEN_NAME(g)}</h3>
          <ul>
            {family.people.filter((p) => show.has(p.id) && gen.get(p.id) === g).map((p) => (
              <li key={p.id}><button type="button" className={`ft-card ft-row${selected === p.id ? ' is-sel' : ''}${p.id === family.rootId ? ' is-root' : ''}`} aria-pressed={selected === p.id} onClick={() => onSelect?.(p.id)}>{render(p)}</button></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
