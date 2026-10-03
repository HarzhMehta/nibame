"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import CustomSelect, { type CustomSelectOption } from "../../components/custom-select";
import type {
  CommunityPost,
  CommunityPostKind,
  CommunitySummary,
} from "../../lib/community-types";
import { getBuiltInCategories } from "../../lib/url-categorizer";

interface CommunityViewProps {
  initialCommunity: CommunitySummary;
  initialPosts: Array<CommunityPost>;
  initialNextCursor?: string;
}

interface PostPageResponse {
  data?: {
    posts?: Array<CommunityPost>;
    nextCursor?: string;
    post?: CommunityPost;
    imported?: { kind: CommunityPostKind; id: string };
  };
  error?: { message?: string };
}

/** Render one joined community with finite categorized posts and private imports. */
export default function CommunityView({
  initialCommunity,
  initialPosts,
  initialNextCursor,
}: CommunityViewProps): ReactElement {
  const [community, setCommunity] = useState(initialCommunity);
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [postKind, setPostKind] = useState<CommunityPostKind>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Array<string>>([]);
  const categoryOptions = useMemo<Array<CustomSelectOption>>(
    () => getBuiltInCategories().map((category) => ({
      value: category.id,
      label: category.label,
    })),
    [],
  );
  const filterOptions = useMemo<Array<CustomSelectOption>>(
    () => [{ value: "all", label: "All categories" }, ...categoryOptions],
    [categoryOptions],
  );
  const hasPending = posts.some(
    (post) => post.metadataStatus === "pending" || post.metadataStatus === "processing",
  );

  useEffect(() => {
    if (!community.isJoined || !hasPending) return;
    const timer = window.setInterval(() => {
      void fetch("/api/communities/" + community.id + "/posts")
        .then((response) => response.json())
        .then((payload: PostPageResponse) => {
          if (payload.data?.posts) {
            setPosts((current) => {
              const refreshed = new Map(payload.data!.posts!.map((post) => [post.id, post]));
              return current.map((post) => refreshed.get(post.id) ?? post);
            });
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [community.id, community.isJoined, hasPending]);

  const visiblePosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return posts.filter((post) => {
      if (filterCategory !== "all" && post.categoryId !== filterCategory) return false;
      if (!normalized) return true;
      return [post.title, post.text, post.description ?? "", post.sourceName ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(normalized));
    });
  }, [filterCategory, posts, query]);

  const join = async (): Promise<void> => {
    setBusyId(community.id);
    setError("");
    try {
      const response = await fetch("/api/communities/" + community.id + "/join", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not join this community.");
      setCommunity((current) => ({
        ...current,
        isJoined: true,
        memberCount: current.memberCount + 1,
      }));
      const postsResponse = await fetch("/api/communities/" + community.id + "/posts");
      const postsPayload = (await postsResponse.json()) as PostPageResponse;
      if (postsResponse.ok && postsPayload.data?.posts) {
        setPosts(postsPayload.data.posts);
        setNextCursor(postsPayload.data.nextCursor);
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join.");
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (): Promise<void> => {
    setBusyId(community.id);
    setError("");
    try {
      const response = await fetch("/api/communities/" + community.id + "/join", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not leave this community.");
      setCommunity((current) => ({
        ...current,
        isJoined: false,
        memberCount: Math.max(0, current.memberCount - 1),
      }));
      setPosts([]);
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave.");
    } finally {
      setBusyId(null);
    }
  };

  const createPost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsPosting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/communities/" + community.id + "/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: postKind,
          url: postKind === "link" ? url : undefined,
          text,
          categoryId: categoryId || undefined,
        }),
      });
      const payload = (await response.json()) as PostPageResponse;
      if (!response.ok || !payload.data?.post) {
        throw new Error(payload.error?.message ?? "Could not add this post.");
      }
      setPosts((current) => [payload.data!.post!, ...current]);
      setCommunity((current) => ({ ...current, postCount: current.postCount + 1 }));
      setUrl("");
      setText("");
      setCategoryId("");
      setSuccess(postKind === "link" ? "Link shared." : "Note shared.");
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not add this post.");
    } finally {
      setIsPosting(false);
    }
  };

  const saveEdit = async (post: CommunityPost): Promise<void> => {
    setBusyId(post.id);
    setError("");
    try {
      const response = await fetch("/api/community-posts/" + post.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingText, categoryId: editingCategory || undefined }),
      });
      const payload = (await response.json()) as PostPageResponse;
      if (!response.ok || !payload.data?.post) {
        throw new Error(payload.error?.message ?? "Could not update this post.");
      }
      setPosts((current) =>
        current.map((candidate) => candidate.id === post.id ? payload.data!.post! : candidate),
      );
      setEditingId(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  const deletePost = async (post: CommunityPost): Promise<void> => {
    setBusyId(post.id);
    setError("");
    try {
      const response = await fetch("/api/community-posts/" + post.id, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this post.");
      setPosts((current) => current.filter((candidate) => candidate.id !== post.id));
      setCommunity((current) => ({ ...current, postCount: Math.max(0, current.postCount - 1) }));
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const importPost = async (post: CommunityPost): Promise<void> => {
    setBusyId(post.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/community-posts/" + post.id + "/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      const payload = (await response.json()) as PostPageResponse;
      if (!response.ok || !payload.data?.imported) {
        throw new Error(payload.error?.message ?? "Could not import this item.");
      }
      setImportedIds((current) => [...current, post.id]);
      setSuccess(post.kind === "link" ? "Link added to your Library." : "Note added to your profile.");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import.");
    } finally {
      setBusyId(null);
    }
  };

  const loadMore = async (): Promise<void> => {
    if (!nextCursor) return;
    setBusyId("load-more");
    try {
      const response = await fetch(
        "/api/communities/" + community.id + "/posts?before=" + encodeURIComponent(nextCursor),
      );
      const payload = (await response.json()) as PostPageResponse;
      if (!response.ok || !payload.data?.posts) throw new Error("Could not load more posts.");
      setPosts((current) => [...current, ...payload.data!.posts!]);
      setNextCursor(payload.data.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="community-view">
      <Link className="community-back" href="/communities">← Communities</Link>
      <header className="community-view-header">
        <div
          className="community-view-label"
          style={{ "--community-color": community.categoryColor ?? "#72a7ff" } as CSSProperties}
        >
          <i />
          <span>{community.categoryLabel ?? "General"}</span>
        </div>
        <h1>{community.name}</h1>
        <p>{community.description}</p>
        <div>
          <span>{community.memberCount} members</span>
          <span>{community.postCount} posts</span>
        </div>
        {community.isJoined ? (
          <button type="button" onClick={() => void leave()} disabled={busyId === community.id}>
            Leave
          </button>
        ) : (
          <button type="button" onClick={() => void join()} disabled={busyId === community.id}>
            {busyId === community.id ? "Joining" : "Join community"}
          </button>
        )}
      </header>

      <div className="community-feedback" aria-live="polite">
        {error && <p role="alert">{error}</p>}
        {!error && success && <p className="is-success" role="status">{success}</p>}
      </div>

      {community.isJoined ? (
        <>
          <form className="community-composer" onSubmit={createPost}>
            <div className="community-kind" role="group" aria-label="Post type">
              <button
                type="button"
                aria-pressed={postKind === "link"}
                onClick={() => setPostKind("link")}
              >
                Link
              </button>
              <button
                type="button"
                aria-pressed={postKind === "note"}
                onClick={() => setPostKind("note")}
              >
                Note
              </button>
            </div>
            {postKind === "link" && (
              <label>
                <span>Link</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
              </label>
            )}
            <label>
              <span>{postKind === "link" ? "Short description (optional)" : "Note"}</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={postKind === "link" ? 2 : 4}
                maxLength={postKind === "link" ? 600 : 4000}
                required={postKind === "note"}
              />
            </label>
            <div>
              <span>Category {postKind === "link" ? "(automatic if empty)" : ""}</span>
              <CustomSelect
                id="post-category"
                label="Post category"
                value={categoryId}
                options={[{ value: "", label: "Automatic / Uncategorized" }, ...categoryOptions]}
                onChange={setCategoryId}
                searchable
              />
            </div>
            <button type="submit" disabled={isPosting}>
              {isPosting ? "Sharing" : postKind === "link" ? "Share link" : "Share note"}
            </button>
          </form>

          <div className="community-post-toolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this community"
              aria-label="Search community posts"
            />
            <CustomSelect
              id="community-post-filter"
              label="Filter community posts"
              value={filterCategory}
              options={filterOptions}
              onChange={setFilterCategory}
              searchable
            />
          </div>

          {visiblePosts.length ? (
            <div className="community-post-grid">
              {visiblePosts.map((post) => (
                <article
                  className={"community-post is-" + post.kind}
                  key={post.id}
                  style={{ "--post-color": post.categoryColor } as CSSProperties}
                >
                  {post.imageUrl && (
                    <div
                      className="community-post-image"
                      aria-hidden="true"
                      style={{
                        backgroundImage:
                          "url(/api/media?url=" + encodeURIComponent(post.imageUrl) + ")",
                      }}
                    />
                  )}
                  <div className="community-post-body">
                    <div className="community-post-meta">
                      <i />
                      <span>{post.categoryLabel}</span>
                      <small>{post.authorAlias}</small>
                    </div>
                    {post.kind === "link" && post.normalizedUrl ? (
                      <a href={post.normalizedUrl} target="_blank" rel="noreferrer">
                        <h2>{post.title}</h2>
                      </a>
                    ) : (
                      <h2>{post.title}</h2>
                    )}
                    {post.description && <p>{post.description}</p>}
                    {editingId === post.id ? (
                      <div className="community-edit">
                        <textarea
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          maxLength={post.kind === "link" ? 600 : 4000}
                          rows={3}
                        />
                        <CustomSelect
                          id={"edit-category-" + post.id}
                          label="Edit category"
                          value={editingCategory}
                          options={categoryOptions}
                          onChange={setEditingCategory}
                          searchable
                        />
                        <button type="button" onClick={() => void saveEdit(post)}>Save</button>
                        <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      post.text && <p className="community-post-comment">{post.text}</p>
                    )}
                  </div>
                  <footer>
                    <button
                      type="button"
                      disabled={busyId === post.id || importedIds.includes(post.id)}
                      onClick={() => void importPost(post)}
                    >
                      {importedIds.includes(post.id) ? "Added" : "Add to mine"}
                    </button>
                    {post.isOwn && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(post.id);
                            setEditingText(post.text);
                            setEditingCategory(post.categoryId);
                          }}
                        >
                          Edit
                        </button>
                        {pendingDelete === post.id ? (
                          <>
                            <button type="button" onClick={() => void deletePost(post)}>Delete</button>
                            <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setPendingDelete(post.id)}>Remove</button>
                        )}
                      </>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <p className="community-empty">Nothing here yet.</p>
          )}
          {nextCursor && (
            <button
              className="community-load-more"
              type="button"
              onClick={() => void loadMore()}
              disabled={busyId === "load-more"}
            >
              {busyId === "load-more" ? "Loading" : "Load more"}
            </button>
          )}
        </>
      ) : (
        <div className="community-join-gate">
          <p>Join to read and contribute.</p>
          <button type="button" onClick={() => void join()}>
            Join community
          </button>
        </div>
      )}
    </section>
  );
}
