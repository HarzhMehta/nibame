"use client";

import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  categoryNameExists,
  createCustomCategory,
  createSessionCategoryState,
  findCustomRule,
  parseRuleDomain,
  type CustomCategory,
  type CustomDomainRule,
  type ParsedRuleDomain,
} from "../lib/session-categories";

interface CategoryDefinition {
  id: string;
  label: string;
  color: string;
  domain_count: number;
  examples: Array<string>;
  isCustom?: false;
}

interface CategoriesResponse {
  categories: Array<CategoryDefinition>;
}

interface CategorizationResult {
  domain: string;
  category: string;
  category_label: string;
  color: string;
}

interface OverrideResponse {
  result: CategorizationResult;
}

interface PendingCategoryConflict {
  category: CustomCategory;
  rule: CustomDomainRule;
  parsed: ParsedRuleDomain;
  sampleLink: string;
  existingLabel: string;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function customResult(
  category: CustomCategory,
  parsed: ParsedRuleDomain,
): CategorizationResult {
  return {
    domain: parsed.hostname,
    category: category.id,
    category_label: category.label,
    color: category.color,
  };
}

/** Capture and categorize a URL with an optional manual correction. */
export default function CaptureForm(): ReactElement {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CategorizationResult | null>(null);
  const [categories, setCategories] = useState<Array<CategoryDefinition>>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const initialSessionState = useMemo(() => createSessionCategoryState(), []);
  const [customCategories, setCustomCategories] = useState<Array<CustomCategory>>(
    initialSessionState.categories,
  );
  const [customDomainRules, setCustomDomainRules] = useState<Array<CustomDomainRule>>(
    initialSessionState.rules,
  );
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customSampleLink, setCustomSampleLink] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<PendingCategoryConflict | null>(null);
  const categoryNameRef = useRef<HTMLInputElement>(null);
  const sampleLinkRef = useRef<HTMLInputElement>(null);

  const allCategories = useMemo(
    () => [...categories, ...customCategories],
    [categories, customCategories],
  );

  useEffect(() => {
    const loadCategories = async (): Promise<void> => {
      try {
        const response = await fetch("/api/backend/categories");
        if (!response.ok) return;
        const payload = (await response.json()) as CategoriesResponse;
        setCategories(payload.categories.filter((category) => category.id !== "unknown"));
      } catch {
        setCategories([]);
      }
    };
    void loadCategories();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Enter a link.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setResult(null);
    setIsEditing(false);

    try {
      const sessionRule = findCustomRule(url.trim(), customDomainRules);
      if (sessionRule) {
        const category = customCategories.find(
          (candidate) => candidate.id === sessionRule.categoryId,
        );
        const parsed = parseRuleDomain(url.trim());
        if (category && parsed) {
          setResult(customResult(category, parsed));
          setSelectedCategory(category.id);
          return;
        }
      }

      const response = await fetch("/api/backend/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const payload = (await response.json()) as CategorizationResult;
      setResult(payload);
      setSelectedCategory(payload.category === "unknown" ? "" : payload.category);
      setIsEditing(payload.category === "unknown");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverride = async (): Promise<void> => {
    if (!result || !selectedCategory) return;
    setIsSaving(true);
    setError("");

    try {
      const customCategory = customCategories.find(
        (category) => category.id === selectedCategory,
      );
      if (customCategory) {
        const parsed = parseRuleDomain(result.domain);
        if (!parsed) throw new Error("Could not read this domain.");

        setCustomDomainRules((currentRules) => [
          ...currentRules.filter((rule) => rule.domain !== parsed.ruleDomain),
          { domain: parsed.ruleDomain, categoryId: customCategory.id },
        ]);
        setResult(customResult(customCategory, parsed));
        setIsEditing(false);
        return;
      }

      const response = await fetch("/api/backend/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: result.domain, category: selectedCategory }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const payload = (await response.json()) as OverrideResponse;
      setResult(payload.result);
      setIsEditing(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
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
    setCategoryError("");
    setPendingConflict(null);
    setIsCategoryFormOpen(false);
  };

  const commitCustomCategory = (
    category: CustomCategory,
    rule: CustomDomainRule,
    parsed: ParsedRuleDomain,
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

  const handleCreateCategory = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
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

    const parsed = parseRuleDomain(customSampleLink);
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

    setIsCheckingConflict(true);
    try {
      let existingLabel = existingCustomRule
        ? customCategories.find(
            (candidate) => candidate.id === existingCustomRule.categoryId,
          )?.label ?? "another custom category"
        : "";

      if (!existingLabel) {
        const response = await fetch("/api/backend/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: customSampleLink.trim() }),
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        const builtInResult = (await response.json()) as CategorizationResult;
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
    } catch (caughtError) {
      setCategoryError(
        caughtError instanceof Error ? caughtError.message : "Could not create category.",
      );
    } finally {
      setIsCheckingConflict(false);
    }
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

        <form className="capture-form" onSubmit={(event) => void handleSubmit(event)}>
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
              disabled={isSubmitting}
              autoFocus
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add link"}
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
                    onClick={() => void handleOverride()}
                    disabled={!selectedCategory || isSaving}
                  >
                    {isSaving ? "Saving…" : "Save"}
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
            onSubmit={(event) => void handleCreateCategory(event)}
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
                  disabled={isCheckingConflict || Boolean(pendingConflict)}
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
                  disabled={isCheckingConflict || Boolean(pendingConflict)}
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
                <button type="submit" disabled={isCheckingConflict}>
                  {isCheckingConflict ? "Checking…" : "Create category"}
                </button>
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
