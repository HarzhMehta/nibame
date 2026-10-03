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
      <span>GitHub</span>
      {stars !== null && <strong>★ {stars}</strong>}
    </a>
  );
}
