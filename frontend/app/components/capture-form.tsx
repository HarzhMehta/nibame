"use client";

import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useMemo, useRef, useState } from "react";

import type { SavedLink } from "../lib/link-types";
import {
  categorizeUrl,
  categoryNameExists,
  createCustomCategory,
  getBuiltInCategories,
  parseUrl,
  type CategorizationResult,
  type CategoryDefinition,
  type CategorySummary,
  type CustomCategory,
  type ParsedUrl,
  type SessionDomainRule,
} from "../lib/url-categorizer";
import CustomSelect, { type CustomSelectOption } from "./custom-select";

interface CaptureFormProps {
  initialCustomCategories: Array<CustomCategory>;
  initialCustomDomainRules: Array<SessionDomainRule>;
  initialSavedLinks: Array<SavedLink>;
}

interface PendingCategoryConflict {
  name: string;
  parsed: ParsedUrl;
  sampleLink: string;
  existingLabel: string;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

async function requestData<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Could not save this change. Try again.");
  }
  return payload.data;
}

function customResult(
  category: CategorySummary,
  parsed: ParsedUrl,
): CategorizationResult {
  return {
    domain: parsed.hostname,
    category: category.id,
    category_label: category.label,
    color: category.color,
    matched_by: "user_rule",
    matched_rule: parsed.ruleDomain,
    confidence: "high",
    is_valid: true,
  };
}

function savedLinkResult(link: SavedLink): CategorizationResult {
  return {
    domain: link.domain,
    category: link.categoryId,
    category_label: link.categoryLabel,
    color: link.color,
    matched_by: "saved_link",
    matched_rule: link.ruleDomain,
    confidence: "high",
    is_valid: true,
  };
}

/** Capture and categorize a URL with persistent user corrections. */
export default function CaptureForm({
  initialCustomCategories,
  initialCustomDomainRules,
  initialSavedLinks,
}: CaptureFormProps): ReactElement {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CategorizationResult | null>(null);
  const categories = useMemo<Array<CategoryDefinition>>(() => getBuiltInCategories(), []);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [customCategories, setCustomCategories] = useState(initialCustomCategories);
  const [customDomainRules, setCustomDomainRules] = useState(initialCustomDomainRules);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customSampleLink, setCustomSampleLink] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");
  const [existingCategoryId, setExistingCategoryId] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [pendingConflict, setPendingConflict] = useState<PendingCategoryConflict | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [savedLinks, setSavedLinks] = useState(initialSavedLinks);
  const [linkFilter, setLinkFilter] = useState("all");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSort, setLinkSort] = useState<"newest" | "oldest">("newest");
  const [pendingDeleteLink, setPendingDeleteLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [categoryDirectoryError, setCategoryDirectoryError] = useState("");
  const categoryNameRef = useRef<HTMLInputElement>(null);
  const sampleLinkRef = useRef<HTMLInputElement>(null);

  const allCategories = useMemo(
    () => [...categories, ...customCategories],
    [categories, customCategories],
  );
  const categoryOptions = useMemo<Array<CustomSelectOption>>(
    () => allCategories.map((category) => ({ value: category.id, label: category.label })),
    [allCategories],
  );

  const visibleSavedLinks = useMemo(() => {
    const query = linkSearch.trim().toLocaleLowerCase();
    return savedLinks
      .filter((link) => linkFilter === "all" || link.categoryId === linkFilter)
      .filter((link) => {
        if (!query) return true;
        return [link.url, link.domain, link.categoryLabel]
          .some((value) => value.toLocaleLowerCase().includes(query));
      })
      .sort((left, right) => {
        const difference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        return linkSort === "newest" ? difference : -difference;
      });
  }, [linkFilter, linkSearch, linkSort, savedLinks]);

  const visibleCategories = useMemo(() => {
    const query = categorySearch.trim().toLocaleLowerCase();
    if (!query) return allCategories;
    return allCategories.filter((category) =>
      [category.label, ...category.examples]
        .some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [allCategories, categorySearch]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Enter a link.");
      return;
    }

    setError("");
    setResult(null);
    setIsEditing(false);
    setIsSavingLink(true);
    try {
      const saved = await requestData<{ link: SavedLink }>("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      setSavedLinks((currentLinks) => [
        saved.link,
        ...currentLinks.filter((candidate) => candidate.id !== saved.link.id),
      ]);
      setResult(savedLinkResult(saved.link));
      setSelectedCategory(saved.link.categoryId === "unknown" ? "" : saved.link.categoryId);
      setIsEditing(saved.link.categoryId === "unknown");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this link.");
    } finally {
      setIsSavingLink(false);
    }
  };

  const applyCategoryToSavedDomain = (
    domain: string,
    category: CategorySummary,
  ): void => {
    setSavedLinks((currentLinks) => currentLinks.map((link) =>
      link.ruleDomain === domain
        ? {
            ...link,
            categoryId: category.id,
            categoryLabel: category.label,
            color: category.color,
            updatedAt: new Date().toISOString(),
          }
        : link,
    ));
    setCustomCategories((currentCategories) => currentCategories.map((candidate) => {
      if (candidate.id !== category.id || candidate.domains.includes(domain)) return candidate;
      return {
        ...candidate,
        domains: [...candidate.domains, domain],
        domain_count: candidate.domain_count + 1,
        examples: [...candidate.examples, domain],
      };
    }));
  };

  const saveRule = async (
    sampleLink: string,
    categoryId: string,
  ): Promise<SessionDomainRule> =>
    requestData<SessionDomainRule>("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleLink, categoryId }),
    });

  const handleOverride = async (): Promise<void> => {
    if (!result || !selectedCategory) return;
    setError("");

    const category = allCategories.find((candidate) => candidate.id === selectedCategory);
    const parsed = parseUrl(result.domain);
    if (!category || !parsed) {
      setError("Could not update this category.");
      return;
    }

    setIsSaving(true);
    try {
      const rule = await saveRule(result.domain, category.id);
      setCustomDomainRules((currentRules) => [
        ...currentRules.filter((candidate) => candidate.domain !== rule.domain),
        rule,
      ]);
      applyCategoryToSavedDomain(rule.domain, category);
      setResult(customResult(category, parsed));
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this change.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (): void => {
    setUrl("");
    setResult(null);
    setError("");
    setIsEditing(false);
  };

  const resetCategoryForm = (): void => {
    setCustomCategoryName("");
    setCustomSampleLink("");
    setCategoryMode("existing");
    setExistingCategoryId("");
    setCategoryError("");
    setPendingConflict(null);
    setIsCategoryFormOpen(false);
  };

  const handleAssignExistingCategory = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setCategoryError("");

    const category = allCategories.find(
      (candidate) => candidate.id === existingCategoryId,
    );
    if (!category) {
      setCategoryError("Choose a category.");
      return;
    }

    const parsed = parseUrl(customSampleLink);
    if (!parsed) {
      setCategoryError("Enter a valid HTTP(S) link or bare domain.");
      sampleLinkRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const rule = await saveRule(customSampleLink, category.id);
      setCustomDomainRules((currentRules) => [
        ...currentRules.filter((candidate) => candidate.domain !== rule.domain),
        rule,
      ]);
      applyCategoryToSavedDomain(rule.domain, category);
      setUrl(customSampleLink.trim());
      setResult(customResult(category, parsed));
      setSelectedCategory(category.id);
      setIsEditing(false);
      resetCategoryForm();

      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".capture-result")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      });
    } catch (saveError) {
      setCategoryError(
        saveError instanceof Error ? saveError.message : "Could not save this assignment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const commitCustomCategory = async (
    name: string,
    parsed: ParsedUrl,
    sampleLink: string,
  ): Promise<void> => {
    setIsSaving(true);
    setCategoryError("");
    try {
      const created = await requestData<{
        category: CustomCategory;
        rule: SessionDomainRule;
      }>("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sampleLink }),
      });
      setCustomCategories((currentCategories) => [...currentCategories, created.category]);
      setCustomDomainRules((currentRules) => [
        ...currentRules.filter((candidate) => candidate.domain !== created.rule.domain),
        created.rule,
      ]);
      applyCategoryToSavedDomain(created.rule.domain, created.category);
      setUrl(sampleLink);
      setResult(customResult(created.category, parsed));
      setSelectedCategory(created.category.id);
      setIsEditing(false);
      resetCategoryForm();

      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".capture-result")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      });
    } catch (saveError) {
      setPendingConflict(null);
      setCategoryError(
        saveError instanceof Error ? saveError.message : "Could not save this category.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalizedName = customCategoryName.trim();
    const nameLength = Array.from(normalizedName).length;

    setCategoryError("");
    setPendingConflict(null);

    if (nameLength < 2 || nameLength > 40) {
      setCategoryError("Use a category name between 2 and 40 characters.");
      categoryNameRef.current?.focus();
      return;
    }

    if (categoryNameExists(normalizedName, allCategories)) {
      setCategoryError("A category with this name already exists.");
      categoryNameRef.current?.focus();
      return;
    }

    const parsed = parseUrl(customSampleLink);
    if (!parsed) {
      setCategoryError("Enter a valid HTTP(S) link or bare domain.");
      sampleLinkRef.current?.focus();
      return;
    }

    const category = createCustomCategory(
      normalizedName,
      parsed.ruleDomain,
      customCategories.length,
    );
    const existingCustomRule = customDomainRules.find(
      (candidate) => candidate.domain === parsed.ruleDomain,
    );

    let existingLabel = existingCustomRule
      ? allCategories.find(
          (candidate) => candidate.id === existingCustomRule.categoryId,
        )?.label ?? "another category"
      : "";

    if (!existingLabel) {
      const builtInResult = categorizeUrl(customSampleLink.trim());
      if (builtInResult.category !== "unknown") {
        existingLabel = builtInResult.category_label;
      }
    }

    if (existingLabel) {
      setPendingConflict({
        name: category.label,
        parsed,
        sampleLink: customSampleLink.trim(),
        existingLabel,
      });
      return;
    }

    void commitCustomCategory(normalizedName, parsed, customSampleLink.trim());
  };

  const handleConfirmConflict = (): void => {
    if (!pendingConflict) return;
    void commitCustomCategory(
      pendingConflict.name,
      pendingConflict.parsed,
      pendingConflict.sampleLink,
    );
  };

  const handleCreateCategoryFromResult = (): void => {
    setCategoryMode("new");
    setCustomCategoryName("");
    setCustomSampleLink(url.trim());
    setCategoryError("");
    setPendingConflict(null);
    setIsCategoryFormOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("custom-category-form")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      categoryNameRef.current?.focus();
    });
  };

  const handleDeleteLink = async (id: string): Promise<void> => {
    setDeletingLink(id);
    setLinkError("");
    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove this link. Try again.");
      setSavedLinks((currentLinks) => currentLinks.filter((link) => link.id !== id));
      setPendingDeleteLink(null);
    } catch (deleteError) {
      setLinkError(
        deleteError instanceof Error ? deleteError.message : "Could not remove this link.",
      );
    } finally {
      setDeletingLink(null);
    }
  };

  const handleDeleteCategory = async (categoryId: string): Promise<void> => {
    setDeletingCategory(categoryId);
    setCategoryDirectoryError("");
    try {
      const response = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this category. Try again.");

      setCustomCategories((currentCategories) =>
        currentCategories.filter((category) => category.id !== categoryId),
      );
      setCustomDomainRules((currentRules) =>
        currentRules.filter((rule) => rule.categoryId !== categoryId),
      );
      setSavedLinks((currentLinks) => currentLinks.map((link) => {
        if (link.categoryId !== categoryId) return link;
        const fallback = categorizeUrl(link.url);
        return {
          ...link,
          categoryId: fallback.category,
          categoryLabel: fallback.category_label,
          color: fallback.color,
          updatedAt: new Date().toISOString(),
        };
      }));
      if (result?.category === categoryId) {
        const fallback = categorizeUrl(url);
        setResult(fallback);
        setSelectedCategory(fallback.category === "unknown" ? "" : fallback.category);
        setIsEditing(fallback.category === "unknown");
      }
      if (selectedCategory === categoryId) setSelectedCategory("");
      if (existingCategoryId === categoryId) setExistingCategoryId("");
      if (linkFilter === categoryId) setLinkFilter("all");
      setPendingDeleteCategory(null);
    } catch (deleteError) {
      setCategoryDirectoryError(
        deleteError instanceof Error ? deleteError.message : "Could not delete this category.",
      );
    } finally {
      setDeletingCategory(null);
    }
  };

  return (
    <>
      <section className="capture-page" aria-labelledby="capture-title">
        <div className="capture-card">
        <header className="capture-heading">
          <h1 id="capture-title">Add a link</h1>
          <p>nibame sorts it automatically. Change the category whenever you need.</p>
        </header>

        <form className="capture-form" onSubmit={handleSubmit}>
          <label htmlFor="capture-url">Link</label>
          <div className="capture-input-row">
            <input
              id="capture-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              autoFocus
            />
            <button type="submit" disabled={isSavingLink}>
              {isSavingLink ? "Saving" : "Add link"}
            </button>
          </div>
        </form>

        <div className="capture-feedback" aria-live="polite">
          {error && <p role="alert">{error}</p>}
        </div>

        {result && (
          <article
            className="capture-result"
            style={{ "--capture-color": result.color } as CSSProperties}
          >
            <div className="capture-result-main">
              <i />
              <div>
                <span>{result.domain}</span>
                <h2>{result.category_label}</h2>
              </div>
            </div>

            {!isEditing ? (
              <div className="capture-result-actions">
                <button type="button" onClick={() => setIsEditing(true)}>Change category</button>
                <button type="button" onClick={handleReset}>Add another</button>
              </div>
            ) : (
              <div className="category-editor">
                <span className="category-editor-label">Category</span>
                <div>
                  <CustomSelect
                    id="capture-category"
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={categoryOptions}
                    label="Category"
                    placeholder="Choose category"
                    searchable
                    disabled={isSaving}
                  />
                  <div className="category-editor-actions">
                    <button
                      type="button"
                      onClick={() => void handleOverride()}
                      disabled={!selectedCategory || isSaving}
                    >
                      {isSaving ? "Saving" : "Save"}
                    </button>
                    {result.category === "unknown" && (
                      <button
                        className="category-new-button"
                        type="button"
                        onClick={handleCreateCategoryFromResult}
                        disabled={isSaving}
                      >
                        New category
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>
        )}
        </div>
      </section>

      <section className="saved-links" aria-labelledby="saved-links-title">
        <header className="saved-links-heading">
          <div>
            <h2 id="saved-links-title">Saved links</h2>
            <span>{savedLinks.length}</span>
          </div>
          <div className="saved-links-controls">
            <label className="saved-links-search">
              <span>Search</span>
              <input
                type="search"
                value={linkSearch}
                onChange={(event) => setLinkSearch(event.target.value)}
                placeholder="Search links"
              />
            </label>
            <div className="saved-links-control">
              <span>Category</span>
              <CustomSelect
                id="saved-links-category"
                value={linkFilter}
                onChange={setLinkFilter}
                options={[{ value: "all", label: "All categories" }, ...categoryOptions]}
                label="Filter by category"
                searchable
              />
            </div>
            <div className="saved-links-control">
              <span>Order</span>
              <CustomSelect
                id="saved-links-order"
                value={linkSort}
                onChange={(value) => setLinkSort(value as "newest" | "oldest")}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
                label="Sort saved links"
              />
            </div>
          </div>
        </header>

        <div className="saved-links-feedback" aria-live="polite">
          {linkError && <p role="alert">{linkError}</p>}
        </div>

        {visibleSavedLinks.length ? (
          <div className="saved-link-list">
            {visibleSavedLinks.map((link) => (
              <article className="saved-link-row" key={link.id}>
                <i style={{ "--link-color": link.color } as CSSProperties} />
                <div className="saved-link-address">
                  <a href={link.normalizedUrl} target="_blank" rel="noreferrer">
                    {link.domain}
                  </a>
                  <span>{link.url}</span>
                </div>
                <span className="saved-link-category">{link.categoryLabel}</span>
                <div className="saved-link-actions">
                  {pendingDeleteLink === link.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleDeleteLink(link.id)}
                        disabled={deletingLink === link.id}
                      >
                        {deletingLink === link.id ? "Removing" : "Delete"}
                      </button>
                      <button type="button" onClick={() => setPendingDeleteLink(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPendingDeleteLink(link.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="saved-links-empty">
            {savedLinks.length ? "No links in this view." : "No saved links yet."}
          </p>
        )}
      </section>

      <section className="product-categories" aria-labelledby="categories-title">
        <header className="product-categories-heading">
          <h2 id="categories-title">Categories</h2>
          <div className="product-categories-tools">
            <input
              type="search"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
            />
            <span>{visibleCategories.length} shown</span>
            <button
              type="button"
              aria-expanded={isCategoryFormOpen}
              aria-controls="custom-category-form"
              onClick={() => {
                setIsCategoryFormOpen((current) => !current);
                setCategoryError("");
                setPendingConflict(null);
              }}
            >
              {isCategoryFormOpen ? "Close" : "+ Add category"}
            </button>
          </div>
        </header>

        <div className="category-directory-feedback" aria-live="polite">
          {categoryDirectoryError && <p role="alert">{categoryDirectoryError}</p>}
        </div>

        {isCategoryFormOpen && (
          <form
            id="custom-category-form"
            className="custom-category-form"
            onSubmit={
              categoryMode === "existing"
                ? handleAssignExistingCategory
                : handleCreateCategory
            }
          >
            <div className="category-mode" role="group" aria-label="Category action">
              <button
                type="button"
                aria-pressed={categoryMode === "existing"}
                onClick={() => {
                  setCategoryMode("existing");
                  setCategoryError("");
                  setPendingConflict(null);
                }}
              >
                Existing category
              </button>
              <button
                type="button"
                aria-pressed={categoryMode === "new"}
                onClick={() => {
                  setCategoryMode("new");
                  setCategoryError("");
                  setPendingConflict(null);
                }}
              >
                New category
              </button>
            </div>

            <div className="custom-category-fields">
              {categoryMode === "new" ? (
                <label>
                  <span>Category name</span>
                  <input
                    ref={categoryNameRef}
                    type="text"
                    value={customCategoryName}
                    onChange={(event) => setCustomCategoryName(event.target.value)}
                    minLength={2}
                    maxLength={40}
                    disabled={Boolean(pendingConflict) || isSaving}
                    autoFocus
                  />
                </label>
              ) : (
                <div className="custom-category-field">
                  <span>Category</span>
                  <CustomSelect
                    id="existing-category"
                    value={existingCategoryId}
                    onChange={setExistingCategoryId}
                    options={categoryOptions}
                    label="Category"
                    placeholder="Choose category"
                    searchable
                    disabled={isSaving}
                  />
                </div>
              )}
              <label>
                <span>Sample link</span>
                <input
                  ref={sampleLinkRef}
                  type="text"
                  inputMode="url"
                  value={customSampleLink}
                  onChange={(event) => setCustomSampleLink(event.target.value)}
                  placeholder="https://example.com"
                  disabled={Boolean(pendingConflict) || isSaving}
                />
              </label>
            </div>

            {categoryError && <p className="custom-category-error" role="alert">{categoryError}</p>}

            {pendingConflict ? (
              <div className="category-conflict" role="status">
                <p>
                  {pendingConflict.parsed.ruleDomain} is currently assigned to {pendingConflict.existingLabel}.
                  Use {pendingConflict.name} instead?
                </p>
                <div>
                  <button type="button" onClick={handleConfirmConflict} disabled={isSaving}>
                    {isSaving ? "Saving" : "Use new category"}
                  </button>
                  <button type="button" onClick={() => setPendingConflict(null)} disabled={isSaving}>
                    Keep current
                  </button>
                </div>
              </div>
            ) : (
              <div className="custom-category-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving
                    ? "Saving"
                    : categoryMode === "existing"
                      ? "Assign category"
                      : "Create category"}
                </button>
                <button type="button" onClick={resetCategoryForm} disabled={isSaving}>Cancel</button>
              </div>
            )}
          </form>
        )}

        {visibleCategories.length ? (
        <div className="product-category-grid">
          {visibleCategories.map((category, index) => (
            <article
              className={`product-category-card${category.isCustom ? " is-custom" : ""}`}
              key={category.id}
              style={{ "--category-color": category.color } as CSSProperties}
            >
              <div className="product-category-meta">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <i />
                <small>
                  {category.isCustom ? "Custom" : `${category.domain_count} domains`}
                </small>
              </div>
              <h3>{category.label}</h3>
              <div className="product-category-examples">
                {category.examples.slice(0, 3).map((domain) => (
                  <code key={domain}>{domain}</code>
                ))}
              </div>
              {category.isCustom && (
                <div className="category-card-actions">
                  {pendingDeleteCategory === category.id ? (
                    <>
                      <span>Delete category?</span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCategory(category.id)}
                        disabled={deletingCategory === category.id}
                      >
                        {deletingCategory === category.id ? "Deleting" : "Delete"}
                      </button>
                      <button type="button" onClick={() => setPendingDeleteCategory(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPendingDeleteCategory(category.id)}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
        ) : (
          <p className="category-directory-empty">No categories found.</p>
        )}
      </section>
    </>
  );
}
