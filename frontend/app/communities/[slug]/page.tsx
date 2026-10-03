import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";

import ProductHeader from "../../components/product-header";
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

/** Render one authenticated community and its member-only feed. */
export default async function CommunityPage({
  params,
}: CommunityPageProps): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let community;
  let page;
  try {
    const { slug } = await params;
    community = await getCommunityBySlug(user, slug);
    page = community.isJoined
      ? await listCommunityPosts(user.id, community.id)
      : { posts: [], nextCursor: undefined };
  } catch (error) {
    if (error instanceof CommunityError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <main className="product-shell">
      <ProductHeader email={user.email} />
      <div className="product-content">
        <CommunityView
          initialCommunity={community}
          initialPosts={page.posts}
          initialNextCursor={page.nextCursor}
        />
      </div>
    </main>
  );
}
