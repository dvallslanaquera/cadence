import { BacklogView } from "@/components/backlog/BacklogView";
import { getLanguageSafe } from "@/server/settings";
import { metadataTitle } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: metadataTitle(await getLanguageSafe(), "page.backlog") };
}

export default function BacklogPage() {
  return <BacklogView />;
}