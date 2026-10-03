"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MobileShareReceiverProps {
  sharedUrl: string;
}

/** Save one Android-shared link through the authenticated link API. */
export default function MobileShareReceiver({
  sharedUrl,
}: MobileShareReceiverProps): ReactElement {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    const save = async (): Promise<void> => {
      try {
        const response = await fetch("/api/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sharedUrl }),
        });
        if (response.status === 401) {
          router.replace("/login?shared=" + encodeURIComponent(sharedUrl));
          return;
        }
        if (!response.ok) throw new Error("Could not save this link.");
        if (isActive) {
          router.replace("/home");
          router.refresh();
        }
      } catch {
        if (isActive) setError("Could not save this link. Try again.");
      }
    };
    void save();
    return () => {
      isActive = false;
    };
  }, [attempt, router, sharedUrl]);

  return (
    <main className="auth-page">
      <section className="auth-card mobile-share-card" aria-live="polite">
        <span>Android share</span>
        <h1>{error ? "Save interrupted" : "Saving link"}</h1>
        <p>{error || "Adding it to your nibame library..."}</p>
        {error && (
          <button type="button" onClick={() => {
            setError("");
            setAttempt((current) => current + 1);
          }}>
            Retry
          </button>
        )}
      </section>
    </main>
  );
}
