'use client';
/**
 * F7 Finance. Overview (cash by fund, income vs spending, what needs action) → Transactions (enter, approve, pay) →
 * Approvals (what I may approve) → Budgets (per center, budget vs actual) → Statements and reports → Finance rules
 * (approval limits, funds, accounts – last 4 digits only, opening balances, plan and audit dates).
 * Rules and budgets publish as the `finance-settings` document; transactions are records saved as they happen.
 * Center-limited roles see and enter only their centers. DEMO: this browser only.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, Tabs, countIssues } from '@/components/editor/bits';
import { ChartCard, LineChart, StatTile } from '@/components/charts/Charts';
import {
  CATEGORY_NAME, EXPENSE, INCOME, KIND, STATUS, approveTx, art12, budgetVsActual, cannotApprove, counts, financeWarnings, fundBalances, monthly, nextStep, statementsDue, transferProblem, usd,
  type Actor, type FinanceSettings, type Tx,
} from '@/lib/community/finance';
import { mockOrgStructure } from '@/lib/community/org-structure';
import { meetingTitle, fmt as fmtD } from '@/lib/community/minutes';
import { useAccess } from '@/lib/access/use-access';
import { nextTxId, saveStatement, saveTx, useLedger } from '@/lib/finance/use-finance';
import { useMeetings } from '@/lib/minutes/use-meetings';
import { csvCell } from '@/lib/community/member-records';

type Doc = { draft: FinanceSettings; setDraft: (f: FinanceSettings | ((d: FinanceSettings) => FinanceSettings)) => void; issues: Record<string, string> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const HQ = 'Headquarters';
const where = (c: string) => c || HQ;
const TONE: Record<Tx['status'], string> = { pending: 'warn', approved: '', paid: 'good', received: 'good', rejected: 'bad', void: '' };
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

export function FinanceView() {
  return (
    <DocEditor<FinanceSettings> storeKey="finance-settings" title="Finance" preview={false}
      intro="The ledger behind donations and Zakat: funds, income and spending, approvals, budgets and statements – with the Bylaws money rules checked (grants over $20,000 a year to one party, restricted funds, the Board limit). Rules and budgets publish; transactions are saved as they happen.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function useScope() {
  const access = useAccess();
  const centers = mockOrgStructure.centers.filter((c) => c.active && access.inScope(c.zone, c.name)).map((c) => c.name);
  const scoped = !!access.role?.centerScoped;
  const seeCenter = (c: string) => (c ? centers.includes(c) : !scoped);
  const actor: Actor = { id: access.me?.id ?? '', name: access.me?.name ?? '', roleId: access.me?.roleId ?? '', centers };
  const canEnter = (c: string) => access.can('finance.manage') || (access.can('center.content') && !!c && centers.includes(c));
  return { access, centers, scoped, seeCenter, actor, canEnter, places: scoped ? centers : ['', ...centers] };
}

function Body({ doc }: { doc: Doc }) {
  const sc = useScope();
  const { txs: all, statements } = useLedger();
  const txs = useMemo(() => all.filter((t) => sc.seeCenter(t.center)), [all, sc.centers.join(), sc.scoped]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string | null>(null);
  const [entry, setEntry] = useState(false);
  const cur = txs.find((t) => t.id === open);
  const mine = txs.filter((t) => t.status === 'pending' && !cannotApprove(t, sc.actor, doc.draft));
  return (
    <div className={`fn${cur ? ' has-peek' : ''}`}>
      <div className="fn-actions">{(sc.access.can('finance.manage') || sc.access.can('center.content')) && <button type="button" className="btn primary" onClick={() => setEntry(true)}>New transaction</button>}</div>
      <Tabs label="Finance" tabs={[
        { id: 'overview', label: 'Dashboard', render: () => <Overview s={doc.draft} txs={txs} statements={statements} sc={sc} onOpen={setOpen} /> },
        { id: 'transactions', label: 'Transactions', render: () => <List s={doc.draft} txs={txs} onOpen={setOpen} places={sc.places} /> },
        { id: 'approvals', label: 'Approvals', badge: mine.length || undefined, render: () => <Approvals s={doc.draft} txs={txs} actor={sc.actor} onOpen={setOpen} /> },
        { id: 'budgets', label: 'Budgets', badge: countIssues(doc.issues, ['budgets']), render: () => <Budgets doc={doc} txs={txs} places={sc.places} canEdit={sc.access.can('finance.manage')} /> },
        { id: 'reports', label: 'Statements and reports', render: () => <Reports s={doc.draft} txs={txs} statements={statements} centers={sc.centers} canMark={sc.access.can('finance.manage')} showFunds={!sc.scoped} /> },
        { id: 'rules', label: 'Finance rules', badge: countIssues(doc.issues, ['approval', 'accounts', 'funds']), render: () => <Rules doc={doc} /> },
      ]} />
      {cur && <TxPanel t={cur} s={doc.draft} all={all} actor={sc.actor} canPay={sc.access.can('finance.manage') || (sc.canEnter(cur.center) && cur.amountCents <= 100_000)} onClose={() => setOpen(null)} />}
      {entry && <Entry s={doc.draft} all={all} places={sc.places} canEnter={sc.canEnter} actor={sc.actor} onClose={() => setEntry(false)} onSaved={(id) => { setEntry(false); setOpen(id); }} />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ s, txs: allTxs, statements, sc: scope, onOpen }: { s: FinanceSettings; txs: Tx[]; statements: ReturnType<typeof useLedger>['statements']; sc: ReturnType<typeof useScope>; onOpen: (id: string) => void }) {
  const t = todayCT();
  const ds = useDashScope('year');
  const narrowed = !!(ds.zone || ds.masjid);
  const sc = narrowed ? { ...scope, scoped: true, centers: scope.centers.filter((c) => (!ds.masjid || c === ds.masjid) && (!ds.zone || ds.zoneOf(c) === ds.zone)) } : scope; // a filtered view hides organization-wide fund balances
  const txs = allTxs.filter((x) => ds.match(undefined, x.center));
  const funds = fundBalances(s, allTxs);
  const cash = funds.reduce((a, f) => a + f.balanceCents, 0), restricted = funds.filter((f) => f.restricted).reduce((a, f) => a + f.balanceCents, 0);
  const mo = monthly(txs, s.year).filter((m) => m.month <= t.slice(0, 7));
  const ytdIn = mo.reduce((a, m) => a + m.incomeCents, 0), ytdOut = mo.reduce((a, m) => a + m.expenseCents, 0);
  const warns = financeWarnings(s, txs, statements, sc.centers, t).filter((w) => !sc.scoped || !w.text.startsWith('The ') );
  return (
    <div className="fn-over">
      <DashBar s={ds} show={{ zone: !scope.scoped, masjid: true }} report={{ href: '/finance?tab=reports', label: 'Statements and reports' }} onExport={() => exportPage('finance-dashboard')} extra={<span className="mo-chip">Fiscal year {s.year}</span>} />
      <div className="zk-kpis">
        {!sc.scoped && <StatTile id="fn-cash" label="Cash in all funds" value={usd(cash)} note={`${usd(restricted)} restricted (${cash ? Math.round((restricted / cash) * 100) : 0}%)`} />}
        <StatTile id="fn-in" label={`Income ${s.year} so far`} value={usd(ytdIn)} spark={mo.map((m) => m.incomeCents / 100)} />
        <StatTile id="fn-out" label={`Spent ${s.year} so far`} value={usd(ytdOut)} note={ytdIn ? `${Math.round((ytdOut / ytdIn) * 100)}% of income` : ''} />
        <StatTile id="fn-wait" label="Waiting for approval" value={String(txs.filter((x) => x.status === 'pending').length)} tone={txs.some((x) => x.status === 'pending') ? 'down' : undefined} note={usd(txs.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amountCents, 0))} />
      </div>
      {warns.length > 0 && <section className="glass-pane zk-list of-warns" aria-label="To fix"><h2>To fix <span className="pill">{warns.length}</span></h2>
        <ul>{warns.map((w, i) => <li key={i} className={w.level}>{w.tx ? <button type="button" className="linkish" onClick={() => onOpen(w.tx!)}>{w.text}</button> : w.text}</li>)}</ul></section>}
      <div className="zk-charts">
        <ChartCard id="fn-trend" className="zk-wide" title="Income and spending by month" note="Received income and paid expenses (pending and approved-but-unpaid are not counted)." table={{ head: ['Month', 'Income', 'Spent'], rows: mo.map((m) => [m.month, usd(m.incomeCents), usd(m.expenseCents)]) }}>
          <LineChart label="Income and spending" labels={mo.map((m) => new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }))} series={[{ id: 'in', name: 'Income', values: mo.map((m) => m.incomeCents / 100), slot: 1 }, { id: 'out', name: 'Spent', values: mo.map((m) => m.expenseCents / 100), slot: 2 }]} format={money} height={220} />
        </ChartCard>
      </div>
      {!sc.scoped && <section className="glass-pane zk-list" aria-label="Funds">
        <h2>Funds</h2><p className="muted">Restricted money may only be spent on its purpose. Balances: opening on January 1, plus income received, minus payments made, plus or minus approved transfers.</p>
        <ul className="fn-funds">{funds.map((f) => <li key={f.id} data-fund={f.id} className={f.balanceCents < 0 ? 'neg' : ''}><span>{f.name}{f.restricted && <span className="pill">Restricted</span>}</span><b>{usd(f.balanceCents)}</b><small>+{usd(f.incomeCents)} in · −{usd(f.spentCents)} paid{f.purpose ? ` · ${f.purpose}` : ''}</small></li>)}</ul>
      </section>}
    </div>
  );
}

/* ---------------- Transactions ---------------- */
function List({ s, txs, onOpen, places }: { s: FinanceSettings; txs: Tx[]; onOpen: (id: string) => void; places: string[] }) {
  const [kind, setKind] = useState(''); const [fund, setFund] = useState(''); const [center, setCenter] = useState('*'); const [status, setStatus] = useState(''); const [q, setQ] = useState('');
  const rows = txs.filter((t) => (!kind || t.kind === kind) && (!fund || t.fund === fund || t.toFund === fund) && (center === '*' || t.center === center) && (!status || t.status === status) && (!q || `${t.id} ${t.party} ${t.memo} ${t.ref}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const fname = (id: string) => s.funds.find((f) => f.id === id)?.name ?? id;
  const csv = () => {
    const out = [['Id', 'Date', 'Kind', 'Amount', 'Fund', 'To fund', 'Center', 'Category', 'Payee / payer', 'Method', 'Check / ref', 'Status', 'Approved by', 'Source', 'Memo'], ...rows.map((t) => [t.id, t.date, KIND[t.kind], (t.amountCents / 100).toFixed(2), fname(t.fund), t.toFund ? fname(t.toFund) : '', where(t.center), CATEGORY_NAME[t.category] ?? t.category, t.party, t.method, t.ref, STATUS[t.status], t.approvals.map((a) => a.name).join('; '), t.source, t.memo])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `ledger-${todayCT()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="glass-pane zk-list" aria-label="Transactions">
      <div className="bn-bar"><h2>Transactions <span className="pill">{rows.length}</span></h2>
        <input className="in" type="search" aria-label="Search transactions" placeholder="Search payee, memo, check" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="in pill-select" aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Every kind</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="in pill-select" aria-label="Fund" value={fund} onChange={(e) => setFund(e.target.value)}><option value="">Every fund</option>{s.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select className="in pill-select" aria-label="Center" value={center} onChange={(e) => setCenter(e.target.value)}><option value="*">Every place</option>{places.map((c) => <option key={c} value={c}>{where(c)}</option>)}</select>
        <select className="in pill-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Every status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn" onClick={csv}>Download CSV</button>
      </div>
      <div className="table-wrap"><table className="t-plain zk-table fn-table">
        <thead><tr><th>Date</th><th>Payee / payer</th><th>Fund</th><th>Place</th><th className="num">Amount</th><th>Status</th></tr></thead>
        <tbody>{rows.slice(0, 250).map((t) => (
          <tr key={t.id} data-tx={t.id} className={`k-${t.kind}`}>
            <td>{fmtD(t.date)}<small className="block">{t.id}</small></td>
            <td><button type="button" className="zk-name linkish" onClick={() => onOpen(t.id)}>{t.party || KIND[t.kind]}</button><small className="block">{KIND[t.kind]} · {CATEGORY_NAME[t.category] ?? ''}{t.source !== 'manual' ? ` · from ${t.source === 'donations' ? 'Donations' : t.source === 'zakat' ? 'Zakat' : 'Dues'}` : ''}</small></td>
            <td>{fname(t.fund)}{t.toFund && <small className="block">→ {fname(t.toFund)}</small>}</td>
            <td>{where(t.center).replace(' Islamic Center', '')}</td>
            <td className={`num fn-amt ${t.kind === 'income' ? 'in' : t.kind === 'transfer' ? '' : 'out'}`}>{t.kind === 'income' ? '+' : t.kind === 'transfer' ? '' : '−'}{usd(t.amountCents)}</td>
            <td><span className={`pill ${TONE[t.status]}`}>{STATUS[t.status]}</span></td>
          </tr>
        ))}</tbody>
      </table></div>
      {rows.length > 250 && <p className="muted small">Showing the newest 250 – download the CSV for all.</p>}
    </section>
  );
}

/* ---------------- Approvals ---------------- */
function Approvals({ s, txs, actor, onOpen }: { s: FinanceSettings; txs: Tx[]; actor: Actor; onOpen: (id: string) => void }) {
  const pending = txs.filter((t) => t.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const mine = pending.filter((t) => !cannotApprove(t, actor, s)); const others = pending.filter((t) => cannotApprove(t, actor, s));
  const row = (t: Tx, why = '') => (
    <li key={t.id}><button type="button" className="zk-row fn-row" data-approve={t.id} onClick={() => onOpen(t.id)}>
      <span className="zk-row-main"><b>{t.party || KIND[t.kind]}</b><small>{t.id} · {fmtD(t.date)} · {where(t.center)} · {CATEGORY_NAME[t.category]}</small></span>
      <span className="zk-row-amt">{usd(t.amountCents)}<small>{nextStep(t, s)}</small></span>
      <span className="zk-row-tags">{why ? <small>{why}</small> : <span className="pill warn">You can approve</span>}</span>
      <span className="zk-row-act">Open ›</span>
    </button></li>
  );
  const lvl = s.approval.levels.find((l) => l.roleId === actor.roleId);
  return (
    <div className="fn-appr">
      <p className="notice">{lvl ? <>You may approve up to {usd(lvl.upToCents)}{lvl.ownCentersOnly ? ' for your own centers' : ''}. Two approvals above {usd(s.approval.dualSignAboveCents)}; a Board decision above {usd(s.approval.boardAboveCents)}. Nobody approves their own entry or a payment to themselves.</> : 'Your role cannot approve payments. Approval limits are set in Finance rules.'}</p>
      <section className="glass-pane zk-list" aria-label="Waiting for you"><h2>Waiting for you <span className="pill">{mine.length}</span></h2><ul className="zk-rows">{mine.map((t) => row(t))}</ul>{!mine.length && <p className="muted">Nothing for you to approve.</p>}</section>
      <section className="glass-pane zk-list" aria-label="Waiting for others"><h2>Waiting for others <span className="pill">{others.length}</span></h2><ul className="zk-rows">{others.map((t) => row(t, cannotApprove(t, actor, s)))}</ul></section>
    </div>
  );
}

/* ---------------- Budgets ---------------- */
function Budgets({ doc, txs, places, canEdit }: { doc: Doc; txs: Tx[]; places: string[]; canEdit: boolean }) {
  const [c, setC] = useState(places[0] ?? '');
  const s = doc.draft; const i = s.budgets.findIndex((b) => b.center === c); const b = s.budgets[i];
  const rows = budgetVsActual(s, txs, c);
  const set = (f: (x: FinanceSettings) => void) => doc.setDraft((d) => { const n = structuredClone(d); f(n); return n; });
  const yearPart = Math.min(1, (Number(todayCT().slice(5, 7)) - 1 + Number(todayCT().slice(8)) / 31) / 12);
  const addLine = (cat: string) => set((x) => { const k = x.budgets.findIndex((y) => y.center === c); if (k < 0) x.budgets.push({ center: c, lines: { [cat]: 0 }, approvedOn: '', approvedBy: c ? 'Council' : 'Board' }); else x.budgets[k].lines[cat] = x.budgets[k].lines[cat] ?? 0; });
  return (
    <section className="glass-pane zk-list" aria-label="Budget">
      <div className="bn-bar"><h2>Budget {s.year}</h2>
        <select className="in pill-select of-center-pick" aria-label="Budget for" value={c} onChange={(e) => setC(e.target.value)}>{places.map((p) => <option key={p} value={p}>{where(p)}</option>)}</select>
        {b ? <span className={`pill ${b.approvedOn ? 'good' : 'warn'}`}>{b.approvedOn ? `Approved by the ${b.approvedBy} ${fmtD(b.approvedOn)}` : 'Not approved yet'}</span> : <span className="pill warn">No budget</span>}
      </div>
      <p className="muted">{c ? 'The Finance Secretary prepares it; the Council approves it (Bylaws Art. V Sec. 3).' : 'The Treasurer prepares the Society’s budget; the Board approves it.'} The bar shows how much is used; the line marks how far the year is ({Math.round(yearPart * 100)}%).</p>
      <div className="table-wrap"><table className="t-plain zk-table fn-budget">
        <thead><tr><th>Category</th><th className="num">Budget</th><th className="num">Actual</th><th>Used</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.category} data-line={r.category} className={r.income ? 'inc' : ''}>
            <td>{r.name}<small className="block">{r.income ? 'Income' : 'Spending'}</small></td>
            <td className="num">{canEdit && b ? <span className="in-money"><i>$</i><input className="in in-num" type="number" min="0" aria-label={`Budget ${r.name}`} value={(b.lines[r.category] ?? 0) / 100} onChange={(e) => set((x) => { x.budgets[i].lines[r.category] = Math.round(Number(e.target.value || 0) * 100); })} /></span> : usd(r.budgetCents)}</td>
            <td className="num">{usd(r.actualCents)}</td>
            <td><span className={`fn-bar ${!r.income && r.pct !== null && r.pct > 100 ? 'over' : ''}`} style={{ ['--p' as string]: `${Math.min(100, r.pct ?? 0)}%`, ['--y' as string]: `${yearPart * 100}%` }}><i /></span><small>{r.pct === null ? 'no budget' : `${r.pct}%`}</small></td>
          </tr>
        ))}</tbody>
      </table></div>
      {canEdit && <div className="dn-addfund">
        <select className="in" aria-label="Add a budget line" defaultValue="" onChange={(e) => { if (e.target.value) addLine(e.target.value); e.target.value = ''; }}><option value="">Add a budget line…</option>{Object.entries({ ...INCOME, ...EXPENSE }).filter(([k]) => !b?.lines[k]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {b && <><input className="in" type="date" aria-label="Budget approved on" value={b.approvedOn} onChange={(e) => set((x) => { x.budgets[i].approvedOn = e.target.value; })} /><small className="muted">Approved on (the {b.approvedBy})</small></>}
      </div>}
    </section>
  );
}

/* ---------------- Reports ---------------- */
function Reports({ s, txs, statements, centers, canMark, showFunds }: { s: FinanceSettings; txs: Tx[]; statements: ReturnType<typeof useLedger>['statements']; centers: string[]; canMark: boolean; showFunds: boolean }) {
  const t = todayCT();
  const [upTo, setUpTo] = useState(t);
  const funds = fundBalances(s, txs, upTo);
  const transfers = (id: string) => txs.filter((x) => x.kind === 'transfer' && counts(x) && x.date <= upTo && x.date.startsWith(String(s.year))).reduce((a, x) => a + (x.toFund === id ? x.amountCents : 0) - (x.fund === id ? x.amountCents : 0), 0);
  const csv = () => {
    const out = [['Fund', 'Restricted', 'Opening', 'Income', 'Spent', 'Transfers', 'Closing'], ...funds.map((f) => [f.name, f.restricted ? 'Yes' : 'No', usd(f.openingCents), usd(f.incomeCents), usd(f.spentCents), usd(transfers(f.id)), usd(f.balanceCents)])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `fund-activity-${upTo}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const due = statementsDue(centers, statements, s.year, t);
  return (
    <div className="fn-reports">
      {showFunds && <section className="glass-pane zk-list" aria-label="Activity by fund">
        <div className="bn-bar"><h2>Activity by fund, {s.year}</h2><label className="muted small">up to <input className="in" type="date" aria-label="Report up to" value={upTo} onChange={(e) => e.target.value && setUpTo(e.target.value)} /></label><button type="button" className="btn" onClick={csv}>Download CSV</button></div>
        <div className="table-wrap"><table className="t-plain zk-table fn-act">
          <thead><tr><th>Fund</th><th className="num">January 1</th><th className="num">Income</th><th className="num">Spent</th><th className="num">Transfers</th><th className="num">Balance</th></tr></thead>
          <tbody>{funds.map((f) => <tr key={f.id}><td>{f.name}{f.restricted && <small className="block">Restricted</small>}</td><td className="num">{usd(f.openingCents)}</td><td className="num">{usd(f.incomeCents)}</td><td className="num">{usd(f.spentCents)}</td><td className="num">{usd(transfers(f.id))}</td><td className="num"><b>{usd(f.balanceCents)}</b></td></tr>)}
            <tr className="fn-total"><td>Total</td>{(['openingCents', 'incomeCents', 'spentCents'] as const).map((k) => <td key={k} className="num">{usd(funds.reduce((a, f) => a + f[k], 0))}</td>)}<td className="num">{usd(0)}</td><td className="num"><b>{usd(funds.reduce((a, f) => a + f.balanceCents, 0))}</b></td></tr></tbody>
        </table></div>
        <p className="muted small">The audited statements for {s.audit.year} were {s.audit.presentedOn ? `presented ${fmtD(s.audit.presentedOn)}` : 'not presented yet'} · two-year financial plan {s.plan.approvedOn ? `approved ${fmtD(s.plan.approvedOn)}` : 'not approved'}.</p>
      </section>}
      <section className="glass-pane zk-list" aria-label="Quarterly statements">
        <h2>Quarterly statements from centers</h2><p className="muted">Each center’s Finance Secretary sends a quarterly statement to the Treasurer (Bylaws Art. VI Sec. 3) – due 30 days after the quarter.</p>
        <div className="table-wrap"><table className="t-plain zk-table mn-grid fn-q">
          <thead><tr><th>Center</th>{[1, 2, 3, 4].map((q) => <th key={q}>Q{q}</th>)}</tr></thead>
          <tbody>{centers.map((c) => <tr key={c} data-statements={c}><td>{c}</td>{[1, 2, 3, 4].map((q) => {
            const got = statements.find((x) => x.center === c && x.year === s.year && x.quarter === q); const d = due.find((x) => x.center === c && x.quarter === q);
            return <td key={q} className={`mn-cell ${got ? 'ok' : d?.late ? 'miss' : 'later'}`}>{got ? <span title={`Received ${fmtD(got.submittedOn)}`}>✓</span> : d ? (canMark ? <button type="button" className="btn sm" onClick={() => saveStatement({ center: c, year: s.year, quarter: q, submittedOn: t, by: 'Finance Secretary' })}>{d.late ? 'Late – mark received' : 'Mark received'}<span className="sr-only"> {c} Q{q}</span></button> : <span>{d.late ? '✕' : '…'}</span>) : ''}</td>;
          })}</tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}

/* ---------------- Rules ---------------- */
function Rules({ doc }: { doc: Doc }) {
  const s = doc.draft; const e = (k: string) => doc.issues[k];
  const set = (f: (x: FinanceSettings) => void) => doc.setDraft((d) => { const n = structuredClone(d); f(n); return n; });
  const Money = ({ label, v, on, err }: { label: string; v: number; on: (c: number) => void; err?: string }) => <label className="sf-field"><span className="sf-label">{label}</span><span className="in-money"><i>$</i><input className="in" type="number" min="0" aria-label={label} value={v / 100} onChange={(ev) => on(Math.round(Number(ev.target.value || 0) * 100))} /></span>{err && <small className="sf-err">{err}</small>}</label>;
  return (
    <div className="cv">
      <Panel title="Who may approve payments" intro="From the accounting manual the Treasurer keeps (Bylaws Art. IV Sec. 5). A role not listed cannot approve.">
        <div className="table-wrap"><table className="t-plain zk-table fn-levels"><thead><tr><th>Role</th><th>Up to</th><th>Own centers only</th><th /></tr></thead>
          <tbody>{s.approval.levels.map((l, i) => <tr key={i} data-level={l.roleId}>
            <td><input className="in" aria-label={`Approval role ${i + 1}`} value={l.roleId} onChange={(ev) => set((x) => { x.approval.levels[i].roleId = ev.target.value; })} /><small className="block">{l.label}</small></td>
            <td><span className="in-money"><i>$</i><input className="in in-num" type="number" min="0" aria-label={`Limit ${l.roleId}`} value={l.upToCents / 100} onChange={(ev) => set((x) => { x.approval.levels[i].upToCents = Math.round(Number(ev.target.value || 0) * 100); })} /></span></td>
            <td><input type="checkbox" aria-label={`Own centers only ${l.roleId}`} checked={l.ownCentersOnly} onChange={(ev) => set((x) => { x.approval.levels[i].ownCentersOnly = ev.target.checked; })} /></td>
            <td><button type="button" className="linkish" onClick={() => set((x) => { x.approval.levels.splice(i, 1); })}>Remove<span className="sr-only"> {l.roleId}</span></button></td></tr>)}</tbody></table></div>
        <button type="button" className="btn sm" onClick={() => set((x) => { x.approval.levels.push({ roleId: 'finance-team', label: 'New level', upToCents: 100_000, ownCentersOnly: false }); })}>Add a level</button>
        <div className="field-row">
          <Money label="Two approvals (two signatures) above" v={s.approval.dualSignAboveCents} on={(c) => set((x) => { x.approval.dualSignAboveCents = c; })} err={e('approval.dualSignAboveCents')} />
          <Money label="A Board decision is needed above" v={s.approval.boardAboveCents} on={(c) => set((x) => { x.approval.boardAboveCents = c; })} />
        </div>
        <p className="sf-hint">Grants and loans to one person or organization over $20,000 in 12 months always need the Joint Board-Councils (over $50,000 the General Body) – Bylaws Art. XII Sec. 4. That is checked automatically.</p>
      </Panel>
      <Panel title="Funds and opening balances" intro={`Balances on January 1, ${s.year}. Restricted funds can only be spent on their purpose.`}>
        <div className="table-wrap"><table className="t-plain zk-table"><thead><tr><th>Fund</th><th>Restricted</th><th>Purpose</th><th>January 1</th></tr></thead>
          <tbody>{s.funds.map((f, i) => <tr key={f.id}><td><input className="in" aria-label={`Fund name ${f.id}`} value={f.name} onChange={(ev) => set((x) => { x.funds[i].name = ev.target.value; })} /></td>
            <td><input type="checkbox" aria-label={`Restricted ${f.id}`} checked={f.restricted} onChange={(ev) => set((x) => { x.funds[i].restricted = ev.target.checked; })} /></td>
            <td><input className="in" aria-label={`Purpose ${f.id}`} value={f.purpose} onChange={(ev) => set((x) => { x.funds[i].purpose = ev.target.value; })} /></td>
            <td><span className="in-money"><i>$</i><input className="in in-num" type="number" aria-label={`Opening ${f.id}`} value={(s.openingCents[f.id] ?? 0) / 100} onChange={(ev) => set((x) => { x.openingCents[f.id] = Math.round(Number(ev.target.value || 0) * 100); })} /></span></td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Bank accounts" intro="Only the last 4 digits are kept here – full numbers stay with the bank.">
        {s.accounts.map((a, i) => <div key={a.id} className="field-row fn-acct">
          <label className="sf-field"><span className="sf-label">Account</span><input className="in" aria-label={`Account name ${a.id}`} value={a.name} onChange={(ev) => set((x) => { x.accounts[i].name = ev.target.value; })} /></label>
          <label className="sf-field"><span className="sf-label">Bank</span><input className="in" aria-label={`Bank ${a.id}`} value={a.bank} onChange={(ev) => set((x) => { x.accounts[i].bank = ev.target.value; })} /></label>
          <label className="sf-field"><span className="sf-label">Last 4 digits</span><input className="in in-num" aria-label={`Last 4 ${a.id}`} value={a.last4} maxLength={4} onChange={(ev) => set((x) => { x.accounts[i].last4 = ev.target.value; })} aria-invalid={!!e(`accounts.${i}.last4`)} />{e(`accounts.${i}.last4`) && <small className="sf-err">{e(`accounts.${i}.last4`)}</small>}</label>
        </div>)}
      </Panel>
      <Panel title="Plan and audit">
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Two-year financial plan approved by the Board on</span><input className="in" type="date" aria-label="Plan approved on" value={s.plan.approvedOn} onChange={(ev) => set((x) => { x.plan.approvedOn = ev.target.value; })} /><small className="sf-hint">Updated and approved every year (Art. III Sec. 3).</small></label>
          <label className="sf-field"><span className="sf-label">Audited statements for {s.audit.year} presented on</span><input className="in" type="date" aria-label="Audit presented on" value={s.audit.presentedOn} onChange={(ev) => set((x) => { x.audit.presentedOn = ev.target.value; })} /><small className="sf-hint">At the March Joint Board-Councils meeting.</small></label>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- panel and entry ---------------- */
function TxPanel({ t, s, all, actor, canPay, onClose }: { t: Tx; s: FinanceSettings; all: Tx[]; actor: Actor; canPay: boolean; onClose: () => void }) {
  const [ref, setRef] = useState(t.ref); const [err, setErr] = useState('');
  const why = cannotApprove(t, actor, s); const a12 = art12(t, all); const tp = transferProblem(t, s);
  const fname = (id: string) => s.funds.find((f) => f.id === id)?.name ?? id;
  const act = (next: Tx, action: string) => { const e = saveTx(next, action); setErr(e.join(' ')); };
  return (
    <aside className="m-peek zk-case fn-peek glass-float" aria-label={`Transaction ${t.id}`} data-open-tx={t.id}>
      <div className="m-peek-top"><span className="m-peek-pos">{t.id} · {fmtD(t.date)}</span><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{usd(t.amountCents)} · {t.party || KIND[t.kind]}</h2><p className="m-peek-status"><span className={`pill ${TONE[t.status]}`}>{STATUS[t.status]}</span><span className="pill">{KIND[t.kind]}</span>{t.relief && <span className="pill">Disaster relief</span>}</p></div>
      {(a12.text || tp) && <ul className="notice warn-note" role="alert">{a12.text && <li>{a12.text}</li>}{tp && <li>{tp}</li>}</ul>}
      <dl className="m-peek-facts">
        <div><dt>Fund</dt><dd>{fname(t.fund)}{t.toFund ? ` → ${fname(t.toFund)}` : ''}</dd></div>
        <div><dt>Place</dt><dd>{where(t.center)}</dd></div>
        <div><dt>Category</dt><dd>{CATEGORY_NAME[t.category] ?? t.category}</dd></div>
        <div><dt>How</dt><dd>{t.method}{t.ref ? ` · ${t.ref}` : ''}{t.account ? ` · ${s.accounts.find((a) => a.id === t.account)?.name ?? t.account}` : ''}</dd></div>
        {t.boardDecision && <div><dt>Board decision</dt><dd>{t.boardDecision}</dd></div>}
        {t.memo && <div><dt>Memo</dt><dd>{t.memo}</dd></div>}
        <div><dt>Approvals</dt><dd>{t.approvals.length ? t.approvals.map((a) => a.name).join(', ') : 'None yet'} · {nextStep(t, s)}</dd></div>
        {t.source !== 'manual' && <div><dt>Recorded from</dt><dd>{t.source === 'donations' ? 'Donations (F3)' : t.source === 'zakat' ? 'Zakat and Sadaqah (F2)' : 'Membership dues'} – approved there</dd></div>}
      </dl>
      {t.status === 'pending' && <div className="zk-act">
        <h3>Approve</h3>
        {why ? <p className="sf-hint">{why}</p> : <p className="sf-hint">Check the invoice and the budget before approving.</p>}
        <div className="row-actions"><button type="button" className="btn primary" disabled={!!why} onClick={() => act(approveTx(t, actor, s, new Date().toISOString()), 'Payment approved')}>Approve</button>
          {!why && <button type="button" className="btn ghost danger-ghost" onClick={() => act({ ...t, status: 'rejected' }, 'Payment not approved')}>Do not approve</button>}</div>
      </div>}
      {t.status === 'approved' && canPay && <div className="zk-act">
        <h3>{t.kind === 'transfer' ? 'Record the transfer' : 'Pay'}</h3>
        {t.method === 'check' && <label className="sf-field"><span className="sf-label">Check number</span><input className="in" aria-label="Check number" value={ref} onChange={(e) => setRef(e.target.value)} /></label>}
        <button type="button" className="btn primary" onClick={() => act({ ...t, ref, status: t.kind === 'transfer' ? 'paid' : 'paid' }, t.kind === 'transfer' ? 'Transfer recorded' : 'Payment made')}>{t.kind === 'transfer' ? 'Transfer done' : 'Mark as paid'}</button>
      </div>}
      {err && <p className="notice warn-note" role="alert">{err}</p>}
    </aside>
  );
}

function F({ label, children }: { label: string; children: ReactNode }) { return <label className="sf-field"><span className="sf-label">{label}</span>{children}</label>; }
function Entry({ s, all, places, canEnter, actor, onClose, onSaved }: { s: FinanceSettings; all: Tx[]; places: string[]; canEnter: (c: string) => boolean; actor: Actor; onClose: () => void; onSaved: (id: string) => void }) {
  const meetings = useMeetings().filter((m) => ['board', 'joint', 'general-assembly'].includes(m.body)).sort((a, b) => b.date.localeCompare(a.date));
  const allowed = places.filter(canEnter);
  const [f, setF] = useState({ kind: 'expense' as Tx['kind'], date: todayCT(), amount: '', fund: 'general', toFund: '', center: allowed[0] ?? '', category: 'maintenance', party: '', method: 'check' as Tx['method'], account: s.accounts[0]?.id ?? '', memo: '', boardDecision: '', relief: false });
  const [errs, setErrs] = useState<string[]>([]);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const cats = f.kind === 'income' ? INCOME : EXPENSE;
  const draft: Tx = { id: nextTxId(all, Number(f.date.slice(0, 4)) || 2026), date: f.date, kind: f.kind, amountCents: Math.round(Number(f.amount || 0) * 100), fund: f.fund, toFund: f.kind === 'transfer' ? f.toFund : '', center: f.center, category: f.category, party: f.party, method: f.kind === 'transfer' ? 'internal' : f.method, ref: '', account: f.account, memo: f.memo, source: 'manual', status: f.kind === 'income' ? 'received' : 'pending', enteredBy: actor.id, approvals: [], boardDecision: f.boardDecision, relief: f.kind === 'aid' && f.relief };
  const a12 = draft.amountCents ? art12(draft, all) : null; const tp = transferProblem(draft, s);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.amountCents) { setErrs(['Enter the amount.']); return; }
    const p = saveTx(draft, f.kind === 'income' ? 'Income recorded' : 'Payment entered'); setErrs(p); if (!p.length) onSaved(draft.id);
  };
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float zn-dialog" aria-label="New transaction" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>New transaction</h2>
        <div className="seg" role="radiogroup" aria-label="Kind">{(Object.keys(KIND) as Tx['kind'][]).map((k) => <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set({ kind: k, category: k === 'income' ? 'donations' : k === 'aid' ? 'aid' : f.category in EXPENSE ? f.category : 'maintenance' })}>{k === 'aid' ? 'Aid / grant' : KIND[k].split(' ')[0]}</button>)}</div>
        <div className="field-row">
          <F label="Date"><input className="in" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></F>
          <F label="Amount"><span className="in-money"><i>$</i><input className="in" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></span></F>
        </div>
        <div className="field-row">
          <F label={f.kind === 'transfer' ? 'From fund' : 'Fund'}><select className="in" value={f.fund} onChange={(e) => set({ fund: e.target.value })}>{s.funds.map((x) => <option key={x.id} value={x.id}>{x.name}{x.restricted ? ' (restricted)' : ''}</option>)}</select></F>
          {f.kind === 'transfer' ? <F label="To fund"><select className="in" value={f.toFund} onChange={(e) => set({ toFund: e.target.value })}><option value="">Choose…</option>{s.funds.filter((x) => x.id !== f.fund).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F>
            : <F label="Category"><select className="in" value={f.category} onChange={(e) => set({ category: e.target.value })}>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>}
        </div>
        <div className="field-row">
          <F label="Place"><select className="in" value={f.center} onChange={(e) => set({ center: e.target.value })}>{allowed.map((c) => <option key={c} value={c}>{where(c)}</option>)}</select></F>
          {f.kind !== 'transfer' && <F label={f.kind === 'income' ? 'Received from' : 'Pay to'}><input className="in" value={f.party} onChange={(e) => set({ party: e.target.value })} /></F>}
        </div>
        {f.kind !== 'transfer' && f.kind !== 'income' && <div className="field-row">
          <F label="How"><select className="in" value={f.method} onChange={(e) => set({ method: e.target.value as Tx['method'] })}><option value="check">Check</option><option value="ach">Bank transfer (ACH)</option><option value="card">Card</option><option value="cash">Cash</option></select></F>
          <F label="From account"><select className="in" value={f.account} onChange={(e) => set({ account: e.target.value })}>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ···{a.last4}</option>)}</select></F>
        </div>}
        {f.kind === 'aid' && <label className="check"><input type="checkbox" checked={f.relief} onChange={(e) => set({ relief: e.target.checked })} /> <span>Disaster relief collected for a named charity (approved by two thirds of the Board)</span></label>}
        <F label="Board decision (meeting)"><select className="in" value={f.boardDecision} onChange={(e) => set({ boardDecision: e.target.value })}><option value="">None</option>{meetings.map((m) => <option key={m.id} value={m.id}>{fmtD(m.date)} – {meetingTitle(m)}</option>)}</select></F>
        <F label="Memo"><input className="in" value={f.memo} onChange={(e) => set({ memo: e.target.value })} /></F>
        {(a12?.text || tp || draft.amountCents > s.approval.boardAboveCents) && <ul className="notice warn-note" role="status">{a12?.text && <li>{a12.text}</li>}{tp && <li>{tp}</li>}{draft.kind !== 'income' && draft.amountCents > s.approval.boardAboveCents && !f.boardDecision && <li>Over {usd(s.approval.boardAboveCents)} – link the Board decision before it can be approved.</li>}</ul>}
        {errs.length > 0 && <ul className="notice warn-note" role="alert">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">{f.kind === 'income' ? 'Record income' : 'Send for approval'}</button></div>
      </form>
    </dialog>
  );
}
