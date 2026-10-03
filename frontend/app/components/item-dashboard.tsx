"use client";

import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import type { UserItem } from "../lib/item-types";
import {
  cancelItemReminder,
  scheduleItemReminder,
} from "../lib/mobile-capabilities";

interface ItemDashboardProps {
  items: Array<UserItem>;
  onUpdate: (item: UserItem) => void;
  onDelete: (id: string) => void;
}

interface ItemResponse {
  data?: { item?: UserItem };
  error?: { message?: string };
}

function formatReminder(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Render compact task, reminder, note, and completed panels. */
export default function ItemDashboard({
  items,
  onUpdate,
  onDelete,
}: ItemDashboardProps): ReactElement | null {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visibleItems = items.filter((item) => item.status !== "archived");
  const panels = useMemo(() => {
    const active = visibleItems.filter((item) => item.status === "active");
    return [
      {
        id: "tasks",
        title: "Tasks",
        items: active.filter((item) => item.kind === "task"),
      },
      {
        id: "reminders",
        title: "Reminders",
        items: active
          .filter((item) => item.remindAt)
          .sort((left, right) => Date.parse(left.remindAt ?? "") - Date.parse(right.remindAt ?? "")),
      },
      {
        id: "notes",
        title: "Notes",
        items: active.filter((item) => item.kind === "note"),
      },
      {
        id: "completed",
        title: "Completed",
        items: visibleItems.filter((item) => item.status === "done").slice(0, 8),
      },
    ];
  }, [visibleItems]);

  if (!visibleItems.length) return null;

  const updateItem = async (
    item: UserItem,
    action: "complete" | "reopen" | "archive",
  ): Promise<void> => {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch("/api/items/" + item.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as ItemResponse;
      if (!response.ok || !payload.data?.item) {
        throw new Error(payload.error?.message ?? "Could not update this item.");
      }
      onUpdate(payload.data.item);
      try {
        if (action === "reopen") await scheduleItemReminder(payload.data.item);
        else await cancelItemReminder(item.id);
      } catch {
        // The MongoDB update remains successful if device notification APIs are unavailable.
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update this item.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteItem = async (item: UserItem): Promise<void> => {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch("/api/items/" + item.id, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this item.");
      onDelete(item.id);
      try {
        await cancelItemReminder(item.id);
      } catch {
        // The item is already deleted; notification cleanup is best effort.
      }
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this item.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="item-dashboard" aria-labelledby="item-dashboard-title">
      <header>
        <span>Personal / 02</span>
        <h2 id="item-dashboard-title">Tasks, reminders and notes.</h2>
      </header>
      <div className="item-dashboard-feedback" aria-live="polite">
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="item-panel-grid">
        {panels.map((panel) => (
          <article className="item-panel" key={panel.id}>
            <header>
              <h3>{panel.title}</h3>
              <span>{panel.items.length}</span>
            </header>
            {panel.items.length ? (
              <div className="item-list">
                {panel.items.map((item) => (
                  <div className={"item-row is-" + item.kind} key={item.id}>
                    {item.kind === "task" ? (
                      <button
                        className="item-status-button"
                        type="button"
                        aria-label={item.status === "done" ? "Reopen task" : "Complete task"}
                        disabled={busyId === item.id}
                        onClick={() =>
                          void updateItem(item, item.status === "done" ? "reopen" : "complete")
                        }
                      >
                        {item.status === "done" ? "✓" : "○"}
                      </button>
                    ) : (
                      <i className="item-note-mark" aria-hidden="true" />
                    )}
                    <div>
                      <p>{item.text}</p>
                      <small>
                        {item.kind}
                        {item.remindAt ? " · " + formatReminder(item.remindAt) : ""}
                      </small>
                    </div>
                    <div className="item-row-actions">
                      {pendingDelete === item.id ? (
                        <>
                          <button type="button" onClick={() => void deleteItem(item)}>Delete</button>
                          <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => void updateItem(item, "archive")}>
                            Archive
                          </button>
                          <button type="button" onClick={() => setPendingDelete(item.id)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="item-panel-empty">Nothing here.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
