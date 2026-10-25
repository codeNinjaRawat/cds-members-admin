'use client';
/** Home page editor: layout choice, which sections show and in what order, then every text, number and photo. */
import { DEFAULT_SECTIONS, HOME_SECTIONS, type Home, type HomeSection } from '@/lib/content/home';
import { SpotlightSchema } from '@/lib/content/spotlight';
import { DocEditor } from '@/components/editor/DocEditor';
import { countIssues, Panel, ScopedForm, Tabs } from '@/components/editor/bits';

const SECTION_LABEL: Record<HomeSection, { name: string; what: string }> = {
  stats: { name: 'Numbers strip', what: 'Four short facts under the hero' },
  heart: { name: 'Heart line', what: 'One short hadith, quiet and centered' },
  bento: { name: 'Membership tiles', what: 'Deadline countdown, plans, wallet card, find your center, news' },
  steps: { name: 'How to join', what: 'Steps band (classic layout)' },
  plans: { name: 'Plan cards', what: 'Single, Family, Life (classic layout)' },
  life: { name: 'What membership supports', what: 'Photo mosaic of programs' },
  verse: { name: 'Quran verse band', what: 'Rotating verses about giving (edit in Giving)' },
  impact: { name: 'How we helped', what: 'Three real stories (edit in Giving)' },
  needs: { name: 'Who still needs help', what: 'Open cases with Give buttons (edit in Giving)' },
  journey: { name: 'Join in five minutes', what: 'Four-step timeline' },
  houston: { name: 'Houston band', what: 'Big photo with the ISGH story' },
  closing: { name: 'Closing call to action', what: 'Last push to become a member' },
  // R6.5 editorial layout – live sections
  today: { name: 'Today', what: 'Prayer strip for the home masjid + next Jumuah (editorial layout)' },
  deadline: { name: 'Voting deadline', what: 'Days left until the record date (from Membership settings)' },
  week: { name: 'This week', what: 'Automatic activity across the network' },
  masajid: { name: 'Our masajid', what: 'Every active masjid as a card, by zone' },
  services: { name: 'Services', what: 'Service tiles (edit the list under Editorial)' },
  programs: { name: 'Programs and events', what: 'Upcoming events from the events module' },
  give: { name: 'Give', what: 'Live campaigns + Zakat / Sadaqah / masjid buttons' },
  latest: { name: 'News', what: 'Latest three news items' },
  election: { name: 'Election', what: 'Current election status, dates, ballot, results' },
  // 2026-10-25 spotlight layout (membership landing) – content under the Spotlight tab
  slider: { name: 'Smart slider', what: 'Highlights slider (Spotlight tab for the spotlight layout); deadline and price slides fill themselves from Membership settings' },
  benefits: { name: 'Benefits', what: 'Colorful tiles with icons (Spotlight tab)' },
  numbers: { name: 'Numbers band', what: 'The four facts under Hero and zones › Stats' },
  status: { name: 'Can I vote?', what: 'Voting checklist and the status button (Spotlight tab)' },
  faq: { name: 'Questions', what: 'Questions and answers (Spotlight tab)' },
};

export function HomeView() {
  return (
    <DocEditor<Home> storeKey="home" title="Home page" intro="Pick the layout, choose and order the sections, then edit every text, number and photo.">
      {(doc) => {
        const layout = doc.draft.layout ?? 'zones';
        const order: HomeSection[] = doc.draft.sections?.length ? doc.draft.sections : DEFAULT_SECTIONS[layout];
        const hidden = HOME_SECTIONS.filter((s) => !order.includes(s));
        const setOrder = (o: HomeSection[]) => doc.setDraft({ ...doc.draft, sections: o });
        const move = (i: number, d: number) => { const n = [...order]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setOrder(n); };
        return (
          <Tabs label="Home page" tabs={[
            { id: 'layout', label: 'Layout and sections', render: () => (<>
              <Panel title="Layout">
                <div className="layout-cards" role="radiogroup" aria-label="Home layout">
                  {([['spotlight', 'Spotlight (membership landing)', 'Loud and colorful: smart slider, benefit tiles with icons, live plan prices from Membership settings, voting checklist, questions.'], ['editorial', 'Editorial (website v2)', 'Photo hero with quick actions, then live sections: today’s prayers, this week, masajid, services, programs, giving, news, election.'], ['zones', 'Five zones', 'Interactive map of the five zones with a member card. Bold and local.'], ['classic', 'Classic', 'Big headline with the member card and plan cards. Simple and direct.']] as const).map(([id, name, what]) => (
                    <button key={id} type="button" role="radio" aria-checked={layout === id} className={`layout-card${layout === id ? ' active' : ''}`}
                      onClick={() => doc.setDraft({ ...doc.draft, layout: id, sections: doc.draft.sections, ...(id === 'spotlight' && !doc.draft.spotlight ? { spotlight: SpotlightSchema.parse({}) } : {}) })}>
                      <span className={`layout-thumb ${id}`} aria-hidden="true"><i /><i /><i /></span>
                      <b>{name}</b><small>{what}</small>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Sections" intro="Shown top to bottom under the hero. Hide what you do not need; nothing is deleted.">
                <ol className="sec-order">
                  {order.map((s, i) => (
                    <li key={s}>
                      <span className="grip" aria-hidden="true">⋮⋮</span>
                      <div><b>{SECTION_LABEL[s].name}</b><small>{SECTION_LABEL[s].what}</small></div>
                      <button type="button" className="sf-icon" aria-label={`Move ${SECTION_LABEL[s].name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="sf-icon" aria-label={`Move ${SECTION_LABEL[s].name} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" className="btn sm ghost" onClick={() => setOrder(order.filter((x) => x !== s))}>Hide</button>
                    </li>
                  ))}
                </ol>
                {hidden.length > 0 && (<>
                  <p className="sub-label">Hidden</p>
                  <ul className="sec-hidden">
                    {hidden.map((s) => <li key={s}><span>{SECTION_LABEL[s].name}</span><button type="button" className="btn sm" onClick={() => setOrder([...order, s])}>Show</button></li>)}
                  </ul>
                </>)}
                <button type="button" className="btn sm ghost" onClick={() => doc.setDraft({ ...doc.draft, sections: undefined })}>Use the recommended order for this layout</button>
              </Panel>
            </>) },
            { id: 'spotlight', label: 'Spotlight', badge: countIssues(doc.issues, ['spotlight']), render: () => <Panel intro="Ticker, headline words and their colors, buttons, slides (a deadline slide counts the days to the record date; a price slide shows the featured plan's real price), benefit tiles with icons, plan sticker, checklist, questions and the closing line. Plan prices come from Settings › Membership & dues.">{doc.draft.spotlight ? <ScopedForm doc={doc} storeKey="home" only={['spotlight']} /> : <button type="button" className="btn sm" onClick={() => doc.setDraft({ ...doc.draft, spotlight: SpotlightSchema.parse({}) })}>Start with the recommended content</button>}</Panel> },
            { id: 'highlights', label: 'Highlights slider', badge: countIssues(doc.issues, ['highlights']), render: () => <Panel intro="The small slider near the top of the home page. Kinds: deadline (counts the days to the voting date – write {days}, {date}, {year}), price (the featured plan – {plan}, {price}, {unit}) or custom. Pick an icon or add a photo, a color and a button. Seconds 0 = no autoplay.">{doc.draft.highlights ? <ScopedForm doc={doc} storeKey="home" only={['highlights']} /> : <button type="button" className="btn sm" onClick={() => doc.setDraft({ ...doc.draft, highlights: { label: 'Highlights', seconds: 6, slides: [{ kind: 'deadline', kicker: 'Voting deadline', title: '{days} days left to keep your vote', text: 'Pay your dues by {date} to vote.', icon: 'vote', tone: 'primary', cta: { label: 'Become a member', href: '/membership/join' } }] } })}>Add the slider</button>}</Panel> },
            { id: 'editorial', label: 'Editorial hero', badge: countIssues(doc.issues, ['editorial']), render: () => <Panel intro="Kicker, headline, photo, the quick-action buttons (what isgh.org’s five buttons did), the home masjid for the prayer strip, service tiles and the giving text."><ScopedForm doc={doc} storeKey="home" only={['editorial']} /></Panel> },
            { id: 'hero', label: 'Hero and zones', badge: countIssues(doc.issues, ['hero', 'zones', 'classicHero', 'stats', 'heartLine']), render: () => <Panel><ScopedForm doc={doc} storeKey="home" only={['hero', 'classicHero', 'stats', 'heartLine', 'zones']} /></Panel> },
            { id: 'blocks', label: 'Sections content', badge: countIssues(doc.issues, ['bento', 'life', 'journey', 'houston', 'closing']), render: () => <Panel><ScopedForm doc={doc} storeKey="home" only={['bento', 'life', 'journey', 'houston', 'closing']} /></Panel> },
            { id: 'join', label: 'Join page photos', badge: countIssues(doc.issues, ['joinImages']), render: () => <Panel intro="Three photos on Become a member."><ScopedForm doc={doc} storeKey="home" only={['joinImages']} /></Panel> },
          ]} />
        );
      }}
    </DocEditor>
  );
}
