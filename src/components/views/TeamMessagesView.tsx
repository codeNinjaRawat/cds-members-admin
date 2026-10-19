'use client';
/**
 * D8 – Team messages (see lib/team/messages.ts). Left: channels and direct threads with unread counts. Right: the
 * thread, a composer with an attachment and a link to a member / ticket / task, and "Make a task" on any message.
 * Keyboard: Enter sends, Shift+Enter is a new line. DEMO: this browser only.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWork } from '@/lib/work/work-store';
import { newId } from '@/lib/community/work';
import {
  attachmentProblem, conversationsFor, directWith, INBOX_EVENT, markRead, mentionsIn, newChannel, readInbox, seedInbox, send, writeInbox,
  type Attachment, type Conversation, type Inbox, type Message, type MessageLink,
} from '@/lib/team/messages';

export function useInbox() {
  const w = useWork();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  useEffect(() => {
    if (!w.ready) return;
    const load = () => { let i = readInbox(); if (!i) { i = seedInbox(w.now, w.admins); writeInbox(i); } setInbox(i); };
    load(); window.addEventListener(INBOX_EVENT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(INBOX_EVENT, load); window.removeEventListener('storage', load); };
  }, [w.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return { w, inbox, update: (f: (i: Inbox) => Inbox) => { const cur = readInbox(); if (cur) writeInbox(f(cur)); } };
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const kb = (n: number) => (n > 900_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export function TeamMessagesView({ search = '' }: { search?: string }) {
  const { w, inbox, update } = useInbox();
  const me = w.me.id;
  const [sel, setSel] = useState<string>(() => new URLSearchParams(search).get('c') ?? '');
  const [text, setText] = useState('');
  const [file, setFile] = useState<Attachment | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [link, setLink] = useState<MessageLink | null>(null);
  const [linkPick, setLinkPick] = useState<'' | 'member' | 'ticket' | 'task'>('');
  const [newDm, setNewDm] = useState(false);
  const [newCh, setNewCh] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const convs = useMemo(() => (inbox ? conversationsFor(inbox, me) : []), [inbox, me]);
  const conv = convs.find((c) => c.id === sel) ?? convs[0];
  const msgs = useMemo(() => (inbox && conv ? inbox.messages.filter((m) => m.convId === conv.id).sort((a, b) => a.at.localeCompare(b.at)) : []), [inbox, conv]);
  useEffect(() => { if (conv && inbox && conv.unread) update((i) => markRead(i, conv.id, me, w.now)); }, [conv?.id, msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, conv?.id]);
  const title = (c: Conversation) => (c.kind === 'channel' ? `# ${c.name}` : c.members.filter((x) => x !== me).map((x) => w.nameOf(x)).join(', ') || 'Just me');
  const others = w.admins.filter((a) => a.id !== me);

  const submit = () => {
    if (!conv || (!text.trim() && !file)) return;
    const links = link ? [link] : [];
    update((i) => send(i, { convId: conv.id, from: me, at: new Date().toISOString(), text: text.trim(), attachments: file ? [file] : [], links }));
    const mentioned = mentionsIn(text, w.admins).filter((id) => id !== me);
    if (mentioned.length) w.setTasks((l) => l);   // live: the API notifies the mentioned people; demo: nothing to do
    setText(''); setFile(null); setLink(null); setLinkPick('');
  };
  const makeTask = (m: Message) => {
    const id = newId('task');
    w.setTasks((l) => [...l, { id, projectId: '', parentId: '', title: m.text.slice(0, 120) || `From ${w.nameOf(m.from)}`, notes: `From Team messages (${title(conv!)}, ${when(m.at)}):\n${m.text}`, owner: me, helpers: m.from !== me ? [m.from] : [], status: 'todo', priority: 'normal', start: '', due: '', labels: [], checklist: [], repeat: null, links: m.links.filter((x) => x.kind !== 'case').map((x) => ({ kind: x.kind as 'member', id: x.id, label: x.label })), comments: [], createdAt: w.now, createdBy: w.me.name, doneAt: '', order: 0 }]);
    update((i) => ({ ...i, messages: i.messages.map((x) => (x.id === m.id ? { ...x, taskId: id } : x)) }));
  };
  const onFile = (f: File | undefined) => {
    setFileErr(''); if (!f) { setFile(null); return; }
    const p = attachmentProblem(f); if (p) { setFileErr(p); return; }
    const r = new FileReader(); r.onload = () => setFile({ name: f.name, type: f.type, size: f.size, dataUrl: f.type.startsWith('image/') ? String(r.result) : undefined }); r.readAsDataURL(f);
  };
  const hrefOf = (l: MessageLink) => (l.kind === 'member' ? `/members/${l.id}` : l.kind === 'ticket' ? `/queues/tickets?ticket=${encodeURIComponent(l.id)}` : l.kind === 'task' ? `/tasks?task=${encodeURIComponent(l.id)}` : `/queues?tab=${l.id}`);

  if (!inbox || !w.ready) return <div className="page tm"><header className="page-head"><div><h1>Team messages</h1></div></header><p className="muted">Loading…</p></div>;
  return (
    <div className="page tm">
      <header className="page-head">
        <div>
          <h1>Team messages</h1>
          <p className="page-intro">Talk to a colleague or a department here instead of email and WhatsApp – with the member, ticket or case attached, and “Make a task” when a note becomes work. Demo – messages stay in this browser.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => { setNewDm(true); setNewCh(false); }}>New message</button>
          <button type="button" className="btn" onClick={() => { setNewCh(true); setNewDm(false); }}>New channel</button>
        </div>
      </header>
      {newDm && (
        <form className="glass-pane tm-new" onSubmit={(e) => { e.preventDefault(); const to = String(new FormData(e.currentTarget).get('to')); if (!to) return; update((i) => directWith(i, me, to).inbox); const cur = readInbox(); const c = cur && directWith(cur, me, to).conv; if (c) setSel(c.id); setNewDm(false); }}>
          <label className="sf-field"><span className="sf-label">To</span><select className="in" name="to" required defaultValue=""><option value="" disabled>Choose a colleague…</option>{others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setNewDm(false)}>Cancel</button><button className="btn primary">Open the thread</button></div>
        </form>
      )}
      {newCh && (
        <form className="glass-pane tm-new" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = String(fd.get('name')); const members = fd.getAll('members').map(String); if (name.trim().length < 2) return; let id = ''; update((i) => { const r = newChannel(i, name, String(fd.get('about') ?? ''), Array.from(new Set([me, ...members]))); id = r.conv.id; return r.inbox; }); if (id) setSel(id); setNewCh(false); }}>
          <div className="field-row">
            <label className="sf-field"><span className="sf-label">Channel name</span><input className="in" name="name" required minLength={2} maxLength={40} placeholder="Weekend school" /></label>
            <label className="sf-field"><span className="sf-label">What it is for</span><input className="in" name="about" maxLength={120} /></label>
          </div>
          <fieldset className="sf-field"><legend className="sf-label">Who is in it (you are added)</legend><div className="chip-row">{others.map((a) => <label key={a.id} className="check"><input type="checkbox" name="members" value={a.id} /> <span>{a.name}</span></label>)}</div></fieldset>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setNewCh(false)}>Cancel</button><button className="btn primary">Create channel</button></div>
        </form>
      )}
      <div className="tm-grid glass-pane">
        <nav className="tm-list" aria-label="Conversations">
          {(['channel', 'direct'] as const).map((k) => (
            <section key={k}>
              <h2 className="tm-h">{k === 'channel' ? 'Channels' : 'Direct'}</h2>
              <ul>{convs.filter((c) => c.kind === k).map((c) => (
                <li key={c.id}><button type="button" className={`tm-conv${conv?.id === c.id ? ' on' : ''}`} aria-current={conv?.id === c.id ? 'true' : undefined} data-conv={c.id} onClick={() => setSel(c.id)}>
                  <b>{title(c)}</b>{c.unread > 0 && <span className="tm-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                  <small>{c.last ? `${w.nameOf(c.last.from).split(' ')[0]}: ${c.last.text.slice(0, 48) || (c.last.attachments[0]?.name ?? '')}` : c.about || 'No messages yet'}</small>
                </button></li>
              ))}{!convs.some((c) => c.kind === k) && <li className="muted small tm-none">{k === 'channel' ? 'No channels yet.' : 'No direct threads yet.'}</li>}</ul>
            </section>
          ))}
        </nav>
        <section className="tm-thread" aria-label={conv ? title(conv) : 'Thread'}>
          {!conv ? <p className="wq-empty">Pick a conversation.</p> : (<>
            <header className="tm-thead">
              <div><h2>{title(conv)}</h2><p className="muted small">{conv.kind === 'channel' ? `${conv.about || 'Channel'} · ${conv.members.length} people` : 'Direct messages'}</p></div>
            </header>
            <ol className="tm-msgs">
              {msgs.map((m) => (
                <li key={m.id} className={`tm-msg${m.from === me ? ' mine' : ''}`} data-msg={m.id}>
                  <span className="m-av" aria-hidden="true">{w.nameOf(m.from).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</span>
                  <div className="tm-body">
                    <div className="tm-meta"><b>{w.nameOf(m.from)}</b><time dateTime={m.at}>{when(m.at)}</time></div>
                    {m.text && <p>{m.text}</p>}
                    {m.attachments.map((a, k) => a.dataUrl ? <a key={k} className="tm-att img" href={a.dataUrl} target="_blank" rel="noreferrer"><img src={a.dataUrl} alt={a.name} /><span>{a.name} · {kb(a.size)}</span></a> : <span key={k} className="tm-att">📎 {a.name} · {kb(a.size)}</span>)}
                    {m.links.length > 0 && <p className="tm-links">{m.links.map((l) => <Link key={`${l.kind}-${l.id}`} className="pill" href={hrefOf(l)}>{l.kind === 'case' ? 'Queue' : l.kind[0].toUpperCase() + l.kind.slice(1)} · {l.label}</Link>)}</p>}
                    <div className="tm-actions">{m.taskId ? <Link className="pill good" href={`/tasks?task=${encodeURIComponent(m.taskId)}`}>Task made</Link> : <button type="button" className="btn sm ghost" onClick={() => makeTask(m)}>Make a task</button>}</div>
                  </div>
                </li>
              ))}
              {!msgs.length && <li className="muted small">Nothing here yet – say salaam.</li>}
            </ol>
            <div ref={endRef} />
            <form className="tm-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label className="sr-only" htmlFor="tm-text">Message</label>
              <textarea id="tm-text" className="in in-area" rows={2} placeholder={`Message ${title(conv)} – @name to mention someone`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <div className="tm-tools">
                <input ref={fileRef} type="file" className="sr-only" accept={'image/*,.pdf,.csv,.txt'} aria-label="Attachment" onChange={(e) => onFile(e.target.files?.[0])} />
                <button type="button" className="btn sm ghost" onClick={() => fileRef.current?.click()}>{file ? `📎 ${file.name}` : 'Attach a picture or file'}</button>
                {file && <button type="button" className="sf-icon" aria-label="Remove attachment" onClick={() => setFile(null)}>×</button>}
                {fileErr && <small className="sf-err">{fileErr}</small>}
                {link ? <span className="pill">{link.kind} · {link.label} <button type="button" className="sf-icon" aria-label="Remove link" onClick={() => setLink(null)}>×</button></span> : (
                  <select className="in sm" aria-label="Link something" value={linkPick} onChange={(e) => setLinkPick(e.target.value as 'member')}><option value="">Link…</option><option value="member">A member</option><option value="ticket">A ticket</option><option value="task">A task</option></select>
                )}
                {linkPick === 'member' && <input className="in sm" aria-label="Member ID" placeholder="Member ID, e.g. HOU-200341" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { setLink({ kind: 'member', id: v, label: v }); setLinkPick(''); } } }} />}
                {linkPick === 'ticket' && <select className="in sm" aria-label="Ticket" onChange={(e) => { const t = w.tickets.find((x) => x.id === e.target.value); if (t) { setLink({ kind: 'ticket', id: t.id, label: `${t.id} ${t.subject}`.slice(0, 50) }); setLinkPick(''); } }}><option value="">Choose a ticket…</option>{w.tickets.slice(0, 40).map((t) => <option key={t.id} value={t.id}>{t.id} · {t.subject}</option>)}</select>}
                {linkPick === 'task' && <select className="in sm" aria-label="Task" onChange={(e) => { const t = w.tasks.find((x) => x.id === e.target.value); if (t) { setLink({ kind: 'task', id: t.id, label: t.title.slice(0, 50) }); setLinkPick(''); } }}><option value="">Choose a task…</option>{w.tasks.filter((t) => t.status !== 'done').slice(0, 40).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
                <button className="btn primary sm tm-send" disabled={!text.trim() && !file}>Send</button>
              </div>
            </form>
          </>)}
        </section>
      </div>
    </div>
  );
}
