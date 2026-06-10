import { redirect } from "next/navigation";

// Legacy route. The canonical table workspace now lives under /pos/tables/[tableId].
// This redirect preserves old bookmarks and removes the deprecated implementation.
export default async function LegacyTableRedirect({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  redirect(`/pos/tables/${tableId}`);
}
