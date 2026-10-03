"use client";

import type { CSSProperties, ReactElement } from "react";
import { useMemo, useState } from "react";

import type { SavedLink } from "../lib/link-types";

type LinkActivityAction = "open" | "archive" | "later";

interface LinkHomeProps {
  links: Array<SavedLink>;
  onLinkUpdate: (link: SavedLink) => void;
}

interface HomeSection {
  id: string;
  title: string;
  reason: string;
  links: Array<SavedLink>;
}

interface LinkThread {
  id: string;
  label: string;
  links: Array<SavedLink>;
}

interface LinkResponse {
  data?: { link?: SavedLink };
  error?: { message?: string };
}

function buildSections(links: Array<SavedLink>): Array<HomeSection> {
  const now = Date.now();
  const available = [...links]
    .filter((link) => link.state !== "archived")
    .filter((link) => !link.resurfaceAfter || Date.parse(link.resurfaceAfter) <= now)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const used = new Set<string>();
  const take = (
    predicate: (link: SavedLink) => boolean,
    count = 6,
  ): Array<SavedLink> => {
    const selected = available.filter((link) => !used.has(link.id) && predicate(link)).slice(0, count);
    selected.forEach((link) => used.add(link.id));
    return selected;
  };
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const candidates: Array<HomeSection> = [
    {
      id: "worth-another-look",
      title: "Worth another look",
      reason: "Saved earlier and never opened",
      links: take((link) => link.openedCount === 0 && now - Date.parse(link.createdAt) >= sevenDays),
    },
    {
      id: "continue",
      title: "Continue",
      reason: "Recently opened",
      links: take((link) => link.openedCount > 0),
    },
    {
      id: "listen-watch",
      title: "Listen & watch",
      reason: "Video, music and podcasts",
      links: take((link) => link.type === "video" || link.type === "audio"),
    },
    {
      id: "plans-places",
      title: "Plans & places",
      reason: "Events, jobs and places to visit",
      links: take(
        (link) => link.type === "event" || link.type === "job" || link.type === "place",
      ),
    },
    {
      id: "decisions",
      title: "Decisions",
      reason: "Products and comparisons",
      links: take((link) => link.type === "product" || link.intent === "buy"),
    },
    {
      id: "things-to-try",
      title: "Things to try",
      reason: "Repositories, tools and experiments",
      links: take((link) => link.type === "repository" || link.intent === "try"),
    },
    {
      id: "quick-reads",
      title: "Quick reads",
      reason: "Five minutes or less",
      links: take(
        (link) =>
          link.type === "article" &&
          Boolean(link.metadata.readingMinutes) &&
          (link.metadata.readingMinutes ?? 99) <= 5,
      ),
    },
    {
      id: "recipes",
      title: "Recipes to try",
      reason: "Saved cooking ideas",
      links: take((link) => link.type === "recipe" || link.intent === "cook"),
    },
    {
      id: "recent",
      title: "Recently saved",
      reason: "Your latest captures",
      links: take(() => true),
    },
  ];
  return candidates.filter((section) => section.links.length);
}

const THREAD_STOP_WORDS = new Set([
  "about", "after", "before", "build", "from", "guide", "into", "learn", "more",
  "official", "that", "their", "this", "using", "with", "your",
]);

function buildThreads(links: Array<SavedLink>): Array<LinkThread> {
  const byKeyword = new Map<string, Array<SavedLink>>();
  for (const link of links.filter((candidate) => candidate.metadataStatus === "ready")) {
    const words = (link.title + " " + (link.description ?? ""))
      .toLocaleLowerCase()
      .match(/[a-z0-9][a-z0-9.+#-]{3,}/g) ?? [];
    for (const keyword of new Set(words)) {
      if (THREAD_STOP_WORDS.has(keyword) || /^\d+$/.test(keyword)) continue;
      const matches = byKeyword.get(keyword) ?? [];
      matches.push(link);
      byKeyword.set(keyword, matches);
    }
  }

  const used = new Set<string>();
  return [...byKeyword.entries()]
    .filter(([, matches]) => matches.length >= 2)
    .sort((left, right) => right[1].length - left[1].length)
    .flatMap(([keyword, matches]) => {
      const uniqueMatches = matches.filter((link) => !used.has(link.id)).slice(0, 4);
      if (uniqueMatches.length < 2) return [];
      uniqueMatches.forEach((link) => used.add(link.id));
      return [{
        id: keyword,
        label: keyword.charAt(0).toLocaleUpperCase() + keyword.slice(1),
        links: uniqueMatches,
      }];
    })
    .slice(0, 3);
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60
    ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m"
    : minutes + " min";
}

function metadataLine(link: SavedLink): string {
  const details: Array<string> = [];
  if (link.metadata.channel) details.push(link.metadata.channel);
  if (link.metadata.language) details.push(link.metadata.language);
  if (typeof link.metadata.stars === "number") {
    details.push(new Intl.NumberFormat("en", { notation: "compact" }).format(link.metadata.stars) + " stars");
  }
  if (link.metadata.durationSeconds) details.push(formatDuration(link.metadata.durationSeconds));
  if (link.metadata.readingMinutes) details.push(link.metadata.readingMinutes + " min read");
  if (typeof link.metadata.price === "number") {
    details.push(
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: link.metadata.currency ?? "INR",
        maximumFractionDigits: 0,
      }).format(link.metadata.price),
    );
  }
  return details.join(" · ");
}

/** Render finite, deterministic home shelves from the saved-link library. */
export default function LinkHome({ links, onLinkUpdate }: LinkHomeProps): ReactElement | null {
  const sections = useMemo(() => buildSections(links), [links]);
  const threads = useMemo(() => buildThreads(links), [links]);
  const [busyLinks, setBusyLinks] = useState<Array<string>>([]);
  const [error, setError] = useState("");

  if (!sections.length) return null;

  const handleAction = async (
    link: SavedLink,
    action: LinkActivityAction,
  ): Promise<void> => {
    setBusyLinks((current) => [...current, link.id]);
    setError("");
    try {
      const response = await fetch("/api/links/" + link.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as LinkResponse;
      if (!response.ok || !payload.data?.link) {
        throw new Error(payload.error?.message ?? "Could not update this link.");
      }
      onLinkUpdate(payload.data.link);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update this link.");
    } finally {
      setBusyLinks((current) => current.filter((id) => id !== link.id));
    }
  };

  return (
    <section className="link-home" aria-labelledby="link-home-title">
      <header className="link-home-heading">
        <div>
          <span>Resurface / 03</span>
          <h2 id="link-home-title">Back within reach.</h2>
        </div>
      </header>

      <div className="link-home-feedback" aria-live="polite">
        {error && <p role="alert">{error}</p>}
      </div>

      {threads.length > 0 && (
        <section className="link-threads" aria-labelledby="link-threads-title">
          <header>
            <h3 id="link-threads-title">Threads forming</h3>
            <span>Grouped by shared context</span>
          </header>
          <div className="link-thread-grid">
            {threads.map((thread) => (
              <article key={thread.id}>
                <div>
                  <span>Shared keyword</span>
                  <h4>{thread.label}</h4>
                </div>
                <ul>
                  {thread.links.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.normalizedUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void handleAction(link, "open")}
                      >
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="link-home-sections">
        {sections.map((section) => (
          <section className="link-shelf" key={section.id} aria-labelledby={section.id}>
            <header>
              <h3 id={section.id}>{section.title}</h3>
              <span>{section.reason}</span>
            </header>
            <div className="link-card-grid">
              {section.links.map((link) => {
                const details = metadataLine(link);
                const isBusy = busyLinks.includes(link.id);
                return (
                  <article
                    className={"smart-link-card is-" + link.type}
                    key={link.id}
                    style={{ "--link-accent": link.color } as CSSProperties}
                  >
                    {link.imageUrl && (
                      <div
                        className="smart-link-media"
                        role="img"
                        aria-label=""
                        style={{
                          backgroundImage:
                            "url(/api/media?url=" + encodeURIComponent(link.imageUrl) + ")",
                        }}
                      />
                    )}
                    <div className="smart-link-body">
                      <div className="smart-link-source">
                        <i />
                        <span>{link.sourceName}</span>
                        <small>
                          {link.metadataStatus === "pending" || link.metadataStatus === "processing"
                            ? "Getting details"
                            : link.type}
                        </small>
                      </div>
                      <h4>{link.title}</h4>
              {(link.userDescription ?? link.description) && (
                <p>{link.userDescription ?? link.description}</p>
              )}
                      {details && <div className="smart-link-details">{details}</div>}
                      <div className="smart-link-category">{link.categoryLabel}</div>
                    </div>
                    <footer className="smart-link-actions">
                      <a
                        href={link.normalizedUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void handleAction(link, "open")}
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleAction(link, "later")}
                        disabled={isBusy}
                      >
                        Later
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction(link, "archive")}
                        disabled={isBusy}
                      >
                        Archive
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
