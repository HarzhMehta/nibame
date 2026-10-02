import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getCurrentUser } from "../lib/auth";
import { parseUrl } from "../lib/url-categorizer";
import MobileShareReceiver from "./mobile-share-receiver";

interface MobileSharePageProps {
  searchParams: Promise<{ url?: string | Array<string> }>;
}

function extractSharedUrl(value: string): string | null {
  const direct = value.trim();
  if (parseUrl(direct)) return direct;
  const match = direct.match(/https?:\/\/[^\s]+/i);
  return match && parseUrl(match[0]) ? match[0] : null;
}

/** Validate and display the Android share handoff. */
export default async function MobileSharePage({
  searchParams,
}: MobileSharePageProps): Promise<ReactElement> {
  const parameter = (await searchParams).url;
  const sharedUrl = typeof parameter === "string" ? extractSharedUrl(parameter.slice(0, 4096)) : null;
  if (!sharedUrl) redirect("/");

  if (!(await getCurrentUser())) {
    redirect("/login?shared=" + encodeURIComponent(sharedUrl));
  }
  return <MobileShareReceiver sharedUrl={sharedUrl} />;
}
