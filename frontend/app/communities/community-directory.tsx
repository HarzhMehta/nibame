"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";

import CustomSelect, { type CustomSelectOption } from "../components/custom-select";
import type { CommunitySummary } from "../lib/community-types";
import { getBuiltInCategories } from "../lib/url-categorizer";

interface CommunityDirectoryProps {
  initialCommunities: Array<CommunitySummary>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

interface CommunityResponse {
  data?: { community?: CommunitySummary };
  error?: { message?: string };
}

/** Render finite community discovery and super-admin creation. */
export default function CommunityDirectory({
  initialCommunities,
  isAuthenticated,
  isSuperAdmin,
}: CommunityDirectoryProps): ReactElement {
  const [communities, setCommunities] = useState(initialCommunities);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const categoryOptions = useMemo<Array<CustomSelectOption>>(
    () => [
      { value: "", label: "No primary category" },
      ...getBuiltInCategories().map((category) => ({
        value: category.id,
        label: category.label,
      })),
    ],
    [],
  );
  const visibleCommunities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return communities;
    return communities.filter((community) =>
      [community.name, community.description, community.categoryLabel ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [communities, query]);

  const join = async (community: CommunitySummary): Promise<void> => {
    setBusyId(community.id);
    setError("");
    try {
      const response = await fetch("/api/communities/" + community.id + "/join", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not join this community.");
      setCommunities((current) => current.map((candidate) =>
        candidate.id === community.id
          ? { ...candidate, isJoined: true, memberCount: candidate.memberCount + 1 }
          : candidate,
      ));
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join.");
    } finally {
      setBusyId(null);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      const response = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, categoryId: categoryId || undefined }),
      });
      const payload = (await response.json()) as CommunityResponse;
      if (!response.ok || !payload.data?.community) {
        throw new Error(payload.error?.message ?? "Could not create this community.");
      }
      setCommunities((current) => [payload.data!.community!, ...current]);
      setName("");
      setDescription("");
      setCategoryId("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create.");
    } finally {
      setIsCreating(false);
    }
  };

  const archive = async (community: CommunitySummary): Promise<void> => {
    setBusyId(community.id);
    setError("");
    try {
      const response = await fetch("/api/communities/" + community.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: community.status !== "archived" }),
      });
      if (!response.ok) throw new Error("Could not update this community.");
      setCommunities((current) => current.map((candidate) =>
        candidate.id === community.id
          ? { ...candidate, status: candidate.status === "active" ? "archived" : "active" }
          : candidate,
      ));
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="community-directory" aria-labelledby="communities-title">
      <header className="community-hero">
        <span>Shared spaces / Public index</span>
        <h1 id="communities-title">Communities</h1>
      </header>

      {isSuperAdmin && (
        <details className="community-create">
          <summary>Create community</summary>
          <form onSubmit={create}>
            <label>
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={10}
                maxLength={500}
                rows={3}
                required
              />
            </label>
            <div>
              <span>Primary category</span>
              <CustomSelect
                id="community-category"
                label="Primary category"
                value={categoryId}
                options={categoryOptions}
                onChange={setCategoryId}
                searchable
              />
            </div>
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating" : "Create community"}
            </button>
          </form>
        </details>
      )}

      <div className="community-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search communities"
          aria-label="Search communities"
        />
        <span>{visibleCommunities.length} spaces</span>
      </div>

      <div className="community-feedback" aria-live="polite">
        {error && <p role="alert">{error}</p>}
      </div>

      {visibleCommunities.length ? (
        <div className="community-grid">
          {visibleCommunities.map((community) => (
            <article
              className={"community-card is-" + community.status}
              key={community.id}
              style={{ "--community-color": community.categoryColor ?? "#72a7ff" } as CSSProperties}
            >
              <div className="community-card-meta">
                <i />
                <span>{community.categoryLabel ?? "General"}</span>
                {community.status === "archived" && <small>Archived</small>}
              </div>
              <h2>{community.name}</h2>
              <p>{community.description}</p>
              <div className="community-counts">
                <span>{community.memberCount} members</span>
                <span>{community.postCount} posts</span>
              </div>
              <footer>
                <Link href={"/communities/" + community.slug}>
                  {community.isJoined ? "Open" : "View"}
                </Link>
                {isAuthenticated && !community.isJoined && (
                  <button
                    type="button"
                    disabled={busyId === community.id || community.status === "archived"}
                    onClick={() => void join(community)}
                  >
                    {busyId === community.id ? "Joining" : "Join"}
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={busyId === community.id}
                    onClick={() => void archive(community)}
                  >
                    {community.status === "archived" ? "Restore" : "Archive"}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <p className="community-empty">No communities found.</p>
      )}
    </section>
  );
}
