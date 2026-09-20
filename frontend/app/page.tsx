import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import CaptureForm from "./components/capture-form";

/** Render the primary nibame capture surface. */
export default function Home(): ReactElement {
  return (
    <main className="product-shell">
      <header className="product-header">
        <Link className="product-brand" href="/" aria-label="nibame home">
          <span className="product-brand-image">
            <Image src="/api/backend/assets/logo.png" alt="" width={96} height={96} priority />
          </span>
          <strong>nibame</strong>
        </Link>
      </header>
      <CaptureForm />
    </main>
  );
}
