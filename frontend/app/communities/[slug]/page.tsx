import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import ProductHeader from "../../components/product-header";
import PublicHeader from "../../components/public-header";
import { getCurrentUser } from "../../lib/auth";
import {
  CommunityError,
  getCommunityBySlug,
  listCommunityPosts,
} from "../../lib/community-service";
import CommunityView from "./community-view";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

/** Render one public community with authenticated contribution controls. */
export default async function CommunityPage({
  params,
}: CommunityPageProps): Promise<ReactElement> {
  const user = await getCurrentUser();

  let community;
  let page;
  try {
    const { slug } = await params;
    community = await getCommunityBySlug(user, slug);
    page = await listCommunityPosts(user?.id ?? null, community.id);
  } catch (error) {
    if (error instanceof CommunityError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <main className={user ? "product-shell" : "public-shell"}>
      {user ? <ProductHeader email={user.email} /> : <PublicHeader />}
      <div className={user ? "product-content" : "public-content"}>
        <CommunityView
          isAuthenticated={Boolean(user)}
          initialCommunity={community}
          initialPosts={page.posts}
          initialNextCursor={page.nextCursor}
        />
      </div>
    </main>
  );
}
