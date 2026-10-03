import Link from "next/link";
import type { ReactElement } from "react";

import PublicHeader from "./components/public-header";

/** Render the public Nibame landing page. */
export default function LandingPage(): ReactElement {
  return (
    <main className="public-shell">
      <PublicHeader />
      <div className="public-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span>Links / Tasks / Reminders / Notes</span>
            <h1 id="landing-title">Paste links. Add tasks. Set reminders.</h1>
            <p>
              Nibame categorizes URLs automatically and keeps tasks, reminders and notes in
              the same workspace. Create your own categories when needed.
            </p>
            <div className="landing-actions">
              <Link href="/home">Open app</Link>
              <Link href="/communities">Browse communities</Link>
            </div>
          </div>
          <div className="landing-index" aria-hidden="true">
            <div><span>01</span><strong>LINK</strong><small>github.com/HarzhMehta/nibame</small></div>
            <div><span>02</span><strong>DEVELOPMENT &amp; CODE</strong><small>Automatic or your own category</small></div>
            <div><span>03</span><strong>TASK</strong><small>Review saved resources</small></div>
            <div><span>04</span><strong>REMINDER</strong><small>Friday, 10:00</small></div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="landing-how-title">
          <header>
            <span>What it handles</span>
            <h2 id="landing-how-title">One capture space</h2>
          </header>
          <ol className="landing-steps">
            <li><span>01</span><h3>Links</h3><p>Paste a URL and receive a category.</p></li>
            <li><span>02</span><h3>Categories</h3><p>Keep the result or create your own rule.</p></li>
            <li><span>03</span><h3>Tasks &amp; Notes</h3><p>Capture a one-line action or thought.</p></li>
            <li><span>04</span><h3>Reminders</h3><p>Add a date and time to a task or note.</p></li>
          </ol>
        </section>

        <section className="landing-split" aria-label="Product areas">
          <article>
            <span>Personal</span>
            <h2>Your private workspace</h2>
            <p>Save categorized links, tasks and notes. Add category rules with a sample link.</p>
            <Link href="/login?next=/home">Sign in</Link>
          </article>
          <article>
            <span>Shared</span>
            <h2>Public communities</h2>
            <p>Read shared links and notes. Sign in to join, post or save a copy.</p>
            <Link href="/communities">View communities</Link>
          </article>
        </section>

        <section className="landing-source">
          <div>
            <span>Open source</span>
            <h2>Build with us</h2>
          </div>
          <a href="https://github.com/HarzhMehta/nibame" target="_blank" rel="noreferrer">
            Open GitHub repository
          </a>
        </section>
      </div>
    </main>
  );
}
