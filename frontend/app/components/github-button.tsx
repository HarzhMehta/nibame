"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

/** Link to the public repository and progressively show its cached star count. */
export default function GitHubButton(): ReactElement {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    void fetch("/api/github")
      .then((response) => response.json())
      .then((payload: { data?: { stars?: number | null } }) => {
        if (typeof payload.data?.stars === "number") setStars(payload.data.stars);
      })
      .catch(() => undefined);
  }, []);

  return (
    <a
      className="product-github"
      href="https://github.com/HarzhMehta/nibame"
      target="_blank"
      rel="noreferrer"
      aria-label={stars === null ? "Open Nibame on GitHub" : "Open Nibame on GitHub, " + stars + " stars"}
    >
      <span className="product-github-action">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0.5a7.7 7.7 0 0 0-2.43 15c.39.07.53-.17.53-.38v-1.49c-2.16.47-2.62-1.04-2.62-1.04-.35-.9-.86-1.14-.86-1.14-.7-.48.05-.47.05-.47.78.05 1.19.8 1.19.8.69 1.18 1.81.84 2.25.64.07-.5.27-.84.49-1.03-1.73-.2-3.54-.86-3.54-3.84 0-.85.3-1.54.8-2.08-.08-.2-.35-.99.08-2.05 0 0 .65-.21 2.12.8A7.4 7.4 0 0 1 8 3.96a7.4 7.4 0 0 1 1.94.26c1.47-1 2.12-.8 2.12-.8.43 1.06.16 1.85.08 2.05.5.54.8 1.23.8 2.08 0 2.99-1.82 3.64-3.55 3.83.28.24.53.72.53 1.45v2.29c0 .21.14.46.54.38A7.7 7.7 0 0 0 8 .5Z" />
        </svg>
        <span>Star</span>
      </span>
      {stars !== null && <strong>{stars}</strong>}
    </a>
  );
}
