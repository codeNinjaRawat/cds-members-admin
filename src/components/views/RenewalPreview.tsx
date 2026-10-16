'use client';
/**
 * "What this means": runs the shared renewal engine on the DRAFT so staff see the real dates before publishing.
 * Pick a join date; each plan shows the paid-through date, when renewal opens, and every reminder / grace / overdue step.
 */
import { useState } from 'react';
import { DEFAULT_LIFECYCLE, formatUSD, type MembershipSettings } from '@/lib/content/membership';
import { canRenew, fmtDay, isISODate, priceFor, timeline } from '@/lib/content/renewal';

const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

export function RenewalPreview({ settings }: { settings: MembershipSettings }) {
  const [start, setStart] = useState(chicagoToday);
  const lc = settings.lifecycle ?? DEFAULT_LIFECYCLE;
  const plans = settings.plans.filter((p) => p.term !== 'lifetime');
  const name = (id: string) => settings.plans.find((p) => p.id === id)?.name;
  const day = isISODate(start) ? start : chicagoToday();
  return (
    <section className="ren-preview glass-pane" aria-labelledby="ren-prev-h">
      <div className="ren-prev-head">
        <h3 id="ren-prev-h">What this means for a new member</h3>
        <label>Joins on <input className="in" type="date" value={day} onChange={(e) => setStart(e.target.value)} /></label>
      </div>
      <p className="muted">Uses the draft above. Lifetime plans never renew and are not shown.</p>
      {!plans.length && <p className="muted">No yearly plans yet.</p>}
      <div className="ren-cards">
        {plans.map((p) => {
          const q = priceFor(p, { start: day, years: 1, saleYear: settings.year });
          const through = q.term.through!;
          const steps = timeline(p, lc, through, name);
          const re = canRenew(p, through, day, lc);
          return (
            <article key={p.id} className="ren-card" data-plan={p.id}>
              <header><b>{p.name}</b><span>{formatUSD(q.totalCents)}{q.prorateCents ? <small> (partial year, {formatUSD(q.prorateCents)} off)</small> : null}</span></header>
              <p className="ren-through">Paid through <b>{fmtDay(through)}</b></p>
              <p className="muted">{re.opensOn ? `Can renew from ${fmtDay(re.opensOn)}` : lc.selfRenew ? 'Can renew any time' : 'Renewed by the office'}</p>
              <ol className="ren-steps">{steps.map((s, i) => <li key={i} className={`k-${s.kind}`}><time dateTime={s.on}>{fmtDay(s.on)}</time><span>{s.label}</span></li>)}</ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}
