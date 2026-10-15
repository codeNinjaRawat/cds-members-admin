import Link from 'next/link';

export default function NotFound() {
  return <div className="page"><div className="panel glass-pane"><h1>This screen does not exist</h1><p className="page-intro">It may be a planned module. <Link href="/">Go to the overview</Link>.</p></div></div>;
}
