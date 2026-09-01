import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 64, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 24 }}>Page Not Found</p>
        <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    </div>
  );
}
