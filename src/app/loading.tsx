/** Shown instantly while a screen loads (Next.js route loading UI) – clicks never feel frozen. */
export default function Loading() {
  return (
    <div className="page" aria-busy="true">
      <div className="route-loading" role="status"><span className="spinner" />Opening…</div>
      <div className="skel-grid" aria-hidden="true"><div className="skel glass-pane" /><div className="skel glass-pane" /><div className="skel glass-pane wide" /></div>
    </div>
  );
}
