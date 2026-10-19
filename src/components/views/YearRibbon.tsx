'use client';
/**
 * The ISGH membership year at a glance – the Overview's hero. A nine-month band from this month on, with the dates the
 * whole organization works toward (Bylaws): renewals open Nov 1, Election Day (second Sunday of December), memberships
 * end Dec 31, new officials take the oath in January, and June 30 – the record date: own dues paid by then = a vote.
 * "Today" sits on the band; the next date is counted down on the left.
 */
import { ORG_TZ } from '@/lib/members/members';
import { useEffect, useRef, useState } from 'react';
import { electionDay, oathDay } from '@/lib/community/officials';

type Mark = { on: string; title: string; note: string; key: 'renew' | 'election' | 'end' | 'oath' | 'record' };
const D = (s: string) => Date.parse(`${s}T12:00:00Z`);
const days = (a: string, b: string) => Math.round((D(b) - D(a)) / 86_400_000);
const short = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthStart = (y: number, m: number) => `${y + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12 + 12) % 12 + 1).padStart(2, '0')}-01`;

/** The organization's dates between `from` and `to` (ISO days). */
export function membershipYear(from: string, to: string): Mark[] {
  const y0 = Number(from.slice(0, 4));
  const out: Mark[] = [];
  for (const y of [y0 - 1, y0, y0 + 1]) {
    out.push(
      { on: `${y}-11-01`, title: 'Renewals open', note: `${y + 1} dues can be paid`, key: 'renew' },
      { on: electionDay(y), title: 'Election Day', note: 'Board, directors and Area Representatives', key: 'election' },
      { on: `${y}-12-31`, title: `${y} memberships end`, note: 'unpaid members move to grace', key: 'end' },
      { on: oathDay(y), title: 'Oath of office', note: 'new terms begin', key: 'oath' },
      { on: `${y + 1}-06-30`, title: 'Record date', note: `own ${y + 1} dues paid by today = a vote`, key: 'record' },
    );
  }
  return out.filter((m) => m.on >= from && m.on <= to).sort((a, b) => a.on.localeCompare(b.on));
}

export function YearRibbon() {
  const [today, setToday] = useState('');
  const band = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => { setToday(new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ })); }, []);
  useEffect(() => {
    const el = band.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 800)); ro.observe(el); return () => ro.disconnect();
  }, [today]);
  if (!today) return <section className="yr glass-pane" aria-hidden="true" />;
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const from = monthStart(y, m), to = monthStart(y, m + 9);
  const span = days(from, to);
  const pos = (s: string) => `${(days(from, s) / span) * 100}%`;
  const marks = membershipYear(from, to);
  const next = marks.find((x) => x.on >= today);
  const months = Array.from({ length: 9 }, (_, i) => monthStart(y, m + i));
  const left = next ? days(today, next.on) : 0;
  // labels never overlap: each mark takes the first lane (above, below, higher, lower) whose last label has ended
  const lanes: number[] = [-Infinity, -Infinity, -Infinity, -Infinity];
  const laneOf = marks.map((x) => {
    const cx = (days(from, x.on) / span) * width;
    const w = Math.max(x.title.length * 7.2, 48) + 16;
    const start = Math.max(0, Math.min(width - w, cx - w / 2));
    const k = lanes.findIndex((end) => end <= start);
    const lane = k < 0 ? 0 : k; lanes[lane] = start + w;
    return lane;
  });
  return (
    <section className="yr glass-pane" aria-labelledby="yr-h">
      <div className="yr-next">
        <h2 id="yr-h" className="sr-only">The membership year</h2>
        {next && <>
          <b className="yr-count">{left === 0 ? 'Today' : left}</b>
          <span className="yr-unit">{left === 0 ? '' : left === 1 ? 'day until' : 'days until'}</span>
          <span className="yr-what">{next.title}</span>
          <small>{short(next.on)} · {next.note}</small>
        </>}
      </div>
      <div className="yr-band" ref={band}>
        <div className="yr-track" aria-hidden="true">
          <span className="yr-done" style={{ width: pos(today) }} />
          {months.map((mo) => <span key={mo} className="yr-month" style={{ left: pos(mo) }}>{new Date(`${mo}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>)}
          <span className="yr-today" style={{ left: pos(today) }}><i />Today</span>
        </div>
        <ol className="yr-marks">
          {marks.map((x, i) => (
            <li key={x.on + x.key} className={`yr-mark k-${x.key}${x === next ? ' next' : ''}${x.on < today ? ' past' : ''} lane-${laneOf[i]}`} style={{ left: pos(x.on) }}>
              <i aria-hidden="true" />
              <span><b>{x.title}</b><small>{short(x.on)}</small></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
