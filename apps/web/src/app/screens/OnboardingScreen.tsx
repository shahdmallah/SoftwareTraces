import { Link } from 'react-router';
import { BrandMark, PageShell } from '../components/web';

export function OnboardingScreen() {
  return (
    <div className="app-frame">
      <PageShell compact>
        <header className="toolbar mb-6 justify-between">
          <BrandMark />
          <Link className="btn btn-secondary" to="/auth">
            Sign in
          </Link>
        </header>

        <section className="panel landing-panel">
          <h1>Traces</h1>
          <p>Find trails, save routes, record activities, and manage your profile.</p>
          <div className="toolbar mt-6">
            <Link className="btn btn-primary" to="/app/explore">
              Open app
            </Link>
            <Link className="btn btn-secondary" to="/auth?mode=signup">
              Create account
            </Link>
          </div>
        </section>
      </PageShell>
    </div>
  );
}
