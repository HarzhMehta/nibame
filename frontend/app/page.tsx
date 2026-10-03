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
            <span>Links / Tasks / Notes</span>
            <h1 id="landing-title">Save it. Find it later.</h1>
            <p>One account for personal captures and shared communities.</p>
            <div className="landing-actions">
              <Link href="/home">Open app</Link>
              <Link href="/communities">Browse communities</Link>
            </div>
          </div>
          <div className="landing-index" aria-hidden="true">
            <div><span>01</span><strong>LINK</strong><small>github.com</small></div>
            <div><span>02</span><strong>TASK</strong><small>Friday, 10:00</small></div>
            <div><span>03</span><strong>NOTE</strong><small>Distributed systems</small></div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="landing-how-title">
          <header>
            <span>How it works</span>
            <h2 id="landing-how-title">Three steps</h2>
          </header>
          <ol className="landing-steps">
            <li><span>01</span><h3>Add</h3><p>Choose Link, Task or Note.</p></li>
            <li><span>02</span><h3>Organize</h3><p>Links are categorized by source.</p></li>
            <li><span>03</span><h3>Return</h3><p>Search, filter or use Home.</p></li>
          </ol>
        </section>

        <section className="landing-split" aria-label="Product areas">
          <article>
            <span>Personal</span>
            <h2>Your private workspace</h2>
            <p>Save links, tasks and notes. Add category rules with a sample link.</p>
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
