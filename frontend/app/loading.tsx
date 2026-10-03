import type { ReactElement } from "react";

/** Render the shared route transition state. */
export default function Loading(): ReactElement {
  return (
    <main className="route-loading" aria-busy="true" aria-label="Loading">
      <div className="route-loading-mark" aria-hidden="true">n</div>
      <div className="route-loading-progress" aria-hidden="true"><i /></div>
    </main>
  );
}
