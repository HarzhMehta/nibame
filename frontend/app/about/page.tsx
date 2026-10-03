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
            <span>Current foundation / URL classification</span>
            <h1 id="about-title">Links, organized automatically.</h1>
            <p>
              Paste a URL. Nibame identifies the source, assigns a category and stores it in
              your Library. Change the result or create your own category with one sample link.
            </p>
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
                  <h3>Paste a link</h3>
                  <p>Enter any HTTP link or bare domain.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Review</h3>
                  <p>Nibame assigns a category using deterministic domain and path rules.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Customize</h3>
                  <p>Choose another category or create one with a sample link.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Return</h3>
                  <p>Use Library to search, filter and open saved links.</p>
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
                URL classification uses deterministic domain and path rules. It does not
                require an LLM.
              </p>
              <p>
                The current focus is fast link capture, reliable classification and
                user-defined rules. Tasks, notes and communities extend the same index.
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
