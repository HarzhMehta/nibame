import type { ReactElement } from "react";

import ProductHeader from "../components/product-header";
import PublicHeader from "../components/public-header";
import { getCurrentUser } from "../lib/auth";

/** Explain the product and its core workflows. */
export default async function AboutPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  return (
    <main className={user ? "product-shell" : "public-shell"}>
      {user ? <ProductHeader email={user.email} /> : <PublicHeader />}
      <div className={user ? "product-content" : "public-content"}>
        <section className="about-page" aria-labelledby="about-title">
          <header className="about-hero">
            <span>About / 03</span>
            <h1 id="about-title">Capture. Sort. Return.</h1>
            <p>Nibame keeps links, tasks and notes in one account.</p>
          </header>

          <section className="about-section" aria-labelledby="about-use-title">
            <header className="about-section-heading">
              <span>Start</span>
              <h2 id="about-use-title">How to use nibame</h2>
            </header>
            <ol className="about-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Personal</h3>
                  <p>Choose Link, Task or Note. Enter it and select Add.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Communities</h3>
                  <p>Join a space. Share a link or note. Use Add to mine to save a copy.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Categories</h3>
                  <p>Open Link categories on Home. Select Add category and provide a sample link.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Return</h3>
                  <p>Use Home to revisit items. Use Library to search and filter links.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="about-section about-details" aria-labelledby="about-product-title">
            <header className="about-section-heading">
              <span>Product</span>
              <h2 id="about-product-title">What it is</h2>
            </header>
            <div className="about-facts">
              <p>
                Nibame is a personal index for information usually split across bookmarks,
                saved posts, direct messages and notes.
              </p>
              <p>
                Link categories use deterministic domain rules. A sample link can add or
                replace a rule for your account.
              </p>
              <p>
                Personal entries stay in your account. Community posts are shared with
                members of that community.
              </p>
            </div>
          </section>

          <section className="about-contribute" aria-labelledby="about-contribute-title">
            <div>
              <span>Open source</span>
              <h2 id="about-contribute-title">Want to contribute?</h2>
            </div>
            <p>There is more to build. Issues and contributions are welcome.</p>
            <a
              href="https://github.com/HarzhMehta/nibame"
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub repository
            </a>
          </section>
        </section>
      </div>
    </main>
  );
}
