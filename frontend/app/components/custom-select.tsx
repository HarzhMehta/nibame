"use client";

import type { KeyboardEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<CustomSelectOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

/** Render an accessible, searchable product-styled dropdown. */
export default function CustomSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Choose an option",
  searchable = false,
  disabled = false,
}: CustomSelectProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    if (searchable) window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, searchable]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    }
  };

  const handleSelect = (nextValue: string): void => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="custom-select" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        id={id}
        ref={triggerRef}
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={id + "-options"}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          setIsOpen((current) => !current);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className={selectedOption ? "" : "is-placeholder"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <i aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="custom-select-popover">
          {searchable && (
            <div className="custom-select-search">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search categories"
                aria-label={"Search " + label.toLocaleLowerCase()}
              />
            </div>
          )}
          <div id={id + "-options"} className="custom-select-options" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <i aria-hidden="true" />}
                </button>
              ))
            ) : (
              <p>No categories found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
