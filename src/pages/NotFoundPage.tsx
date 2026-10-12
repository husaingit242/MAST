import { Link } from 'react-router-dom';
export default function NotFoundPage() { return <main className="not-found"><span className="eyebrow">404 / NOT FOUND</span><h1>That page isn’t here</h1><p>Check the address, or return to the security overview.</p><Link to="/" className="button primary">Go to dashboard</Link></main>; }
