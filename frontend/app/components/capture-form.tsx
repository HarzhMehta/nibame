"use client";

import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useMemo, useRef, useState } from "react";

import {
  categorizeUrl,
  categoryNameExists,
  createCustomCategory,
  findSessionRule,
  getBuiltInCategories,
  parseUrl,
  type CategorizationResult,
  type CategoryDefinition,
  type CategorySummary,
  type CustomCategory,
  type ParsedUrl,
  type SessionDomainRule,
} from "../lib/url-categorizer";

interface PendingCategoryConflict {
  category: CustomCategory;
  rule: SessionDomainRule;
  parsed: ParsedUrl;
  sampleLink: string;
  existingLabel: string;
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
    matched_by: "session_rule",
    matched_rule: parsed.ruleDomain,
    confidence: "high",
    is_valid: true,
  };
}

/** Capture and categorize a URL with an optional manual correction. */
export default function CaptureForm(): ReactElement {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CategorizationResult | null>(null);
  const categories = useMemo<Array<CategoryDefinition>>(() => getBuiltInCategories(), []);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [customCategories, setCustomCategories] = useState<Array<CustomCategory>>([]);
  const [customDomainRules, setCustomDomainRules] = useState<Array<SessionDomainRule>>([]);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customSampleLink, setCustomSampleLink] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [pendingConflict, setPendingConflict] = useState<PendingCategoryConflict | null>(null);
  const categoryNameRef = useRef<HTMLInputElement>(null);
  const sampleLinkRef = useRef<HTMLInputElement>(null);

  const allCategories = useMemo(
    () => [...categories, ...customCategories],
    [categories, customCategories],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Enter a link.");
      return;
    }

    setError("");
    setResult(null);
    setIsEditing(false);

    const sessionRule = findSessionRule(url.trim(), customDomainRules);
    if (sessionRule) {
      const category = allCategories.find(
        (candidate) => candidate.id === sessionRule.categoryId,
      );
      const parsed = parseUrl(url.trim());
      if (category && parsed) {
        setResult(customResult(category, parsed));
        setSelectedCategory(category.id);
        return;
      }
    }

    const categorized = categorizeUrl(url.trim());
    if (!categorized.is_valid) {
      setError("Enter a valid HTTP(S) URL or bare domain.");
      return;
    }
    setResult(categorized);
    setSelectedCategory(categorized.category === "unknown" ? "" : categorized.category);
    setIsEditing(categorized.category === "unknown");
  };

  const handleOverride = (): void => {
    if (!result || !selectedCategory) return;
    setError("");

    const category = allCategories.find((candidate) => candidate.id === selectedCategory);
    const parsed = parseUrl(result.domain);
    if (!category || !parsed) {
      setError("Could not update this category.");
      return;
    }

    setCustomDomainRules((currentRules) => [
      ...currentRules.filter((rule) => rule.domain !== parsed.ruleDomain),
      { domain: parsed.ruleDomain, categoryId: category.id },
    ]);
    setResult(customResult(category, parsed));
    setIsEditing(false);
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
    setCategoryError("");
    setPendingConflict(null);
    setIsCategoryFormOpen(false);
  };

  const commitCustomCategory = (
    category: CustomCategory,
    rule: SessionDomainRule,
    parsed: ParsedUrl,
    sampleLink: string,
  ): void => {
    setCustomCategories((currentCategories) => [...currentCategories, category]);
    setCustomDomainRules((currentRules) => [
      ...currentRules.filter((candidate) => candidate.domain !== rule.domain),
      rule,
    ]);
    setUrl(sampleLink);
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
    const rule = { domain: parsed.ruleDomain, categoryId: category.id };
    const existingCustomRule = customDomainRules.find(
      (candidate) => candidate.domain === parsed.ruleDomain,
    );

    let existingLabel = existingCustomRule
      ? customCategories.find(
          (candidate) => candidate.id === existingCustomRule.categoryId,
        )?.label ?? "another custom category"
      : "";

    if (!existingLabel) {
      const builtInResult = categorizeUrl(customSampleLink.trim());
      if (builtInResult.category !== "unknown") {
        existingLabel = builtInResult.category_label;
      }
    }

    if (existingLabel) {
      setPendingConflict({
        category,
        rule,
        parsed,
        sampleLink: customSampleLink.trim(),
        existingLabel,
      });
      return;
    }

    commitCustomCategory(category, rule, parsed, customSampleLink.trim());
  };

  const handleConfirmConflict = (): void => {
    if (!pendingConflict) return;
    commitCustomCategory(
      pendingConflict.category,
      pendingConflict.rule,
      pendingConflict.parsed,
      pendingConflict.sampleLink,
    );
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
            <button type="submit">Add link</button>
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
                <label htmlFor="capture-category">Category</label>
                <div>
                  <select
                    id="capture-category"
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                  >
                    <option value="">Choose category</option>
                    {allCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOverride}
                    disabled={!selectedCategory}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </article>
        )}
        </div>
      </section>

      <section className="product-categories" aria-labelledby="categories-title">
        <header className="product-categories-heading">
          <h2 id="categories-title">Categories</h2>
          <div>
            <span>{allCategories.length} supported</span>
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

        {isCategoryFormOpen && (
          <form
            id="custom-category-form"
            className="custom-category-form"
            onSubmit={handleCreateCategory}
          >
            <div className="custom-category-fields">
              <label>
                <span>Category name</span>
                <input
                  ref={categoryNameRef}
                  type="text"
                  value={customCategoryName}
                  onChange={(event) => setCustomCategoryName(event.target.value)}
                  minLength={2}
                  maxLength={40}
                  disabled={Boolean(pendingConflict)}
                  autoFocus
                />
              </label>
              <label>
                <span>Sample link</span>
                <input
                  ref={sampleLinkRef}
                  type="text"
                  inputMode="url"
                  value={customSampleLink}
                  onChange={(event) => setCustomSampleLink(event.target.value)}
                  placeholder="https://example.com"
                  disabled={Boolean(pendingConflict)}
                />
              </label>
            </div>

            {categoryError && <p className="custom-category-error" role="alert">{categoryError}</p>}

            {pendingConflict ? (
              <div className="category-conflict" role="status">
                <p>
                  {pendingConflict.rule.domain} is currently assigned to {pendingConflict.existingLabel}.
                  Use {pendingConflict.category.label} instead for this session?
                </p>
                <div>
                  <button type="button" onClick={handleConfirmConflict}>Use new category</button>
                  <button type="button" onClick={() => setPendingConflict(null)}>Keep current</button>
                </div>
              </div>
            ) : (
              <div className="custom-category-actions">
                <button type="submit">Create category</button>
                <button type="button" onClick={resetCategoryForm}>Cancel</button>
              </div>
            )}
          </form>
        )}

        <div className="product-category-grid">
          {allCategories.map((category, index) => (
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
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
